import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { appConfig } from '@/lib/config';
import { orm } from '@/lib/db';
import { buildStorageKey } from '@/lib/storage/keys';
import { exceedsStorageQuota } from '@/lib/storage/quota';
import { createUploadUrl } from '@/lib/storage/s3';
import {
  normalizeStoredMimeType,
  validateUploadRequest,
} from '@/lib/storage/validation';

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(512),
  mimeType: z.string().max(255).optional().default('application/octet-stream'),
  size: z.number().int().positive(),
});

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
    const parsed = uploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
    }

    const uploadSize = BigInt(parsed.data.size);

    if (uploadSize > appConfig.maxUploadBytes) {
      return NextResponse.json({ error: 'File exceeds maximum upload size' }, { status: 413 });
    }

    const filenameValidation = validateUploadRequest({
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
    });

    if (!filenameValidation.ok) {
      return NextResponse.json({ error: filenameValidation.reason }, { status: 415 });
    }

    const dbUser = await orm.User.where({ id: user.id })
      .select('storageQuota', 'storageUsed')
      .first();

    if (!dbUser) {
      return notFoundResponse();
    }

    if (
      exceedsStorageQuota(
        BigInt(dbUser.storageUsed),
        uploadSize,
        BigInt(dbUser.storageQuota),
      )
    ) {
      return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 403 });
    }

    const storedMimeType = normalizeStoredMimeType(parsed.data.mimeType);

    const file = await orm.File.create({
      userId: user.id,
      name: filenameValidation.sanitizedName,
      originalName: filenameValidation.sanitizedName,
      storageKey: 'pending',
      size: uploadSize,
      mimeType: storedMimeType,
      status: 'PENDING',
    });

    const storageKey = buildStorageKey(user.id, file.id);

    await orm.File.where({ id: file.id, userId: user.id }).update({
      storageKey,
    });

    const uploadUrl = await createUploadUrl({
      storageKey,
      size: uploadSize,
    });

    return NextResponse.json({
      fileId: file.id,
      uploadUrl,
      contentType: 'application/octet-stream',
    });
  } catch (uploadError) {
    console.error('Upload request failed', uploadError);
    return NextResponse.json({ error: 'Unable to prepare upload' }, { status: 500 });
  }
}
