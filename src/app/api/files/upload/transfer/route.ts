import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/api/auth';
import { resolveOwnedFileStorage } from '@/lib/storage/owned-file-storage';
import { getStorageService } from '@/lib/storage/storage-service';
import { uploadFailureResponse } from '@/lib/storage/upload-api-errors';

const fileIdSchema = z.string().uuid();

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
    const formData = await request.formData();
    const fileIdValue = formData.get('fileId');
    const fileValue = formData.get('file');

    if (formData.get('storageKey') !== null) {
      return NextResponse.json({ error: 'Invalid upload transfer request' }, { status: 400 });
    }

    const parsedFileId = fileIdSchema.safeParse(fileIdValue);
    if (!parsedFileId.success || !(fileValue instanceof File)) {
      return NextResponse.json({ error: 'Invalid upload transfer request' }, { status: 400 });
    }

    const owned = await resolveOwnedFileStorage({
      userId: user.id,
      fileId: parsedFileId.data,
      mode: 'pending',
    });

    if (!owned || owned.file.status !== 'PENDING') {
      return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
    }

    const reservedSize = BigInt(owned.file.size);
    const uploadSize = BigInt(fileValue.size);
    if (uploadSize <= 0n) {
      return NextResponse.json({ error: 'Invalid upload transfer request' }, { status: 400 });
    }

    if (uploadSize !== reservedSize) {
      return NextResponse.json({ error: 'UPLOAD_SIZE_MISMATCH' }, { status: 400 });
    }

    const body = Buffer.from(await fileValue.arrayBuffer());
    await getStorageService().putObject({
      objectRef: owned.objectRef,
      body,
      size: uploadSize,
    });

    return NextResponse.json({ fileId: owned.file.id, ok: true });
  } catch (transferError) {
    console.error('Upload transfer failed', transferError);
    return uploadFailureResponse('storage_unavailable');
  }
}
