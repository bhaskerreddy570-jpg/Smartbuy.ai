import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/api/auth';
import { normalizeMaxFileSizeBytes } from '@/lib/customer-limits';
import { orm } from '@/lib/db';
import { resolveFileCategory } from '@/lib/storage/categories';
import { FILE_CATEGORIES } from '@/lib/storage/types';
import {
  computeSecureUploadSize,
  rejectForbiddenSecureUploadSecrets,
  secureEncryptionMetadataSchema,
} from '@/lib/storage/secure-upload-metadata';
import { uploadFailureResponse } from '@/lib/storage/upload-api-errors';
import { createPendingUpload } from '@/lib/storage/upload-lifecycle';
import {
  normalizeStoredMimeType,
  validateUploadRequest,
} from '@/lib/storage/validation';

const uploadRequestSchema = z
  .object({
    fileName: z.string().min(1).max(512),
    mimeType: z.string().max(255).optional().default('application/octet-stream'),
    size: z.number().int().positive(),
    category: z.enum(FILE_CATEGORIES).optional(),
    secure: z.boolean().optional().default(false),
    encryption: secureEncryptionMetadataSchema.optional(),
    clientUploadId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.secure && !value.encryption) {
      ctx.addIssue({
        code: 'custom',
        message: 'Secure uploads require encryption metadata',
        path: ['encryption'],
      });
    }

    if (!value.secure && value.encryption) {
      ctx.addIssue({
        code: 'custom',
        message: 'Encryption metadata is only allowed for secure uploads',
        path: ['encryption'],
      });
    }

    if (value.secure && value.encryption) {
      const encryptedSize = computeSecureUploadSize(value.encryption);
      if (encryptedSize !== BigInt(value.size)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Secure upload size must match encrypted payload size',
          path: ['size'],
        });
      }
    }
  });

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error) {
    return error;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    rejectForbiddenSecureUploadSecrets(body);
    const parsed = uploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
    }

    const uploadSize = BigInt(parsed.data.size);
    const userLimits = await orm.User.where({ id: user.id })
      .select('maxFileSizeBytes')
      .first();

    if (!userLimits) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const maxFileSizeBytes = normalizeMaxFileSizeBytes(userLimits.maxFileSizeBytes);

    if (uploadSize > maxFileSizeBytes) {
      return NextResponse.json(
        { error: 'FILE_SIZE_LIMIT_EXCEEDED' },
        { status: 413 },
      );
    }

    if (
      parsed.data.secure &&
      parsed.data.encryption &&
      BigInt(parsed.data.encryption.plaintextSize) > maxFileSizeBytes
    ) {
      return NextResponse.json(
        { error: 'FILE_SIZE_LIMIT_EXCEEDED' },
        { status: 413 },
      );
    }

    const filenameValidation = validateUploadRequest({
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
    });

    if (!filenameValidation.ok) {
      return NextResponse.json({ error: filenameValidation.reason }, { status: 415 });
    }

    const storedMimeType = normalizeStoredMimeType(parsed.data.mimeType);
    const category = resolveFileCategory({
      fileName: filenameValidation.sanitizedName,
      mimeType: storedMimeType,
      requestedCategory: parsed.data.category,
    });

    const pendingUpload = await createPendingUpload({
      userId: user.id,
      fileName: filenameValidation.sanitizedName,
      originalName: filenameValidation.sanitizedName,
      mimeType: storedMimeType,
      uploadSize,
      category,
      secure: parsed.data.secure,
      encryption: parsed.data.encryption,
      clientUploadId: parsed.data.clientUploadId,
    });

    if (!pendingUpload.ok) {
      return uploadFailureResponse(pendingUpload.reason);
    }

    return NextResponse.json({
      fileId: pendingUpload.file.fileId,
      category: pendingUpload.file.category,
      contentType: 'application/octet-stream',
      securityMode: parsed.data.secure ? 'SECURE' : 'NORMAL',
      reusedExisting: pendingUpload.file.reusedExisting === true,
    });
  } catch (uploadError) {
    if (
      uploadError instanceof Error &&
      uploadError.message === 'SECURE_SECRET_REJECTED'
    ) {
      return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
    }

    console.error('Upload request failed', uploadError);
    return NextResponse.json({ error: 'Unable to prepare upload' }, { status: 500 });
  }
}
