import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { appConfig } from '@/lib/config';
import { resolveFileCategory } from '@/lib/storage/categories';
import { FILE_CATEGORIES } from '@/lib/storage/types';
import { createPendingUpload } from '@/lib/storage/upload-lifecycle';
import {
  normalizeStoredMimeType,
  validateUploadRequest,
} from '@/lib/storage/validation';

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(512),
  mimeType: z.string().max(255).optional().default('application/octet-stream'),
  size: z.number().int().positive(),
  category: z.enum(FILE_CATEGORIES).optional(),
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
    });

    if (!pendingUpload.ok) {
      if (pendingUpload.reason === 'quota_exceeded') {
        return NextResponse.json({ error: 'STORAGE_QUOTA_EXCEEDED' }, { status: 413 });
      }

      return notFoundResponse();
    }

    return NextResponse.json({
      fileId: pendingUpload.file.fileId,
      uploadUrl: pendingUpload.file.uploadUrl,
      category: pendingUpload.file.category,
      contentType: 'application/octet-stream',
    });
  } catch (uploadError) {
    console.error('Upload request failed', uploadError);
    return NextResponse.json({ error: 'Unable to prepare upload' }, { status: 500 });
  }
}
