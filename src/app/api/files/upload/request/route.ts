import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { appConfig } from '@/lib/config';
import { orm } from '@/lib/db';
import { buildStorageKey } from '@/lib/storage/keys';
import { createUploadUrl } from '@/lib/storage/s3';
import {
  isAllowedMimeType,
  sanitizeFilename,
} from '@/lib/storage/validation';

const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
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

    if (!isAllowedMimeType(parsed.data.mimeType)) {
      return NextResponse.json({ error: 'File type is not allowed' }, { status: 415 });
    }

    const dbUser = await orm.User.where({ id: user.id })
      .select('storageQuota', 'storageUsed')
      .first();

    if (!dbUser) {
      return notFoundResponse();
    }

    if (dbUser.storageUsed + uploadSize > dbUser.storageQuota) {
      return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 403 });
    }

    const safeName = sanitizeFilename(parsed.data.fileName);

    const file = await orm.File.create({
      userId: user.id,
      name: safeName,
      originalName: safeName,
      storageKey: 'pending',
      size: uploadSize,
      mimeType: parsed.data.mimeType,
      status: 'PENDING',
    });

    const storageKey = buildStorageKey(user.id, file.id);

    await orm.File.where({ id: file.id, userId: user.id }).update({
      storageKey,
    });

    const uploadUrl = await createUploadUrl({
      storageKey,
      mimeType: parsed.data.mimeType,
      size: uploadSize,
    });

    return NextResponse.json({
      fileId: file.id,
      uploadUrl,
    });
  } catch (uploadError) {
    console.error('Upload request failed', uploadError);
    return NextResponse.json({ error: 'Unable to prepare upload' }, { status: 500 });
  }
}
