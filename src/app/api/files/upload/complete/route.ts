import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import { orm } from '@/lib/db';
import { runAntivirusScanHook } from '@/lib/storage/antivirus';
import { deleteObject, getObjectMetadata } from '@/lib/storage/s3';
import { getOwnedFileIncludingPending } from '@/lib/storage/files';
import {
  finalizePendingUpload,
  releaseReservedStorageForUser,
} from '@/lib/storage/upload-lifecycle';
import { validateUploadFilename } from '@/lib/storage/validation';

const completeSchema = z.object({
  fileId: z.string().uuid(),
});

async function cleanupPendingUpload(params: {
  userId: string;
  fileId: string;
  storageKey: string;
  reservedBytes: bigint;
}): Promise<void> {
  await deleteObject(params.storageKey).catch(() => undefined);
  await orm.File.where({ id: params.fileId, userId: params.userId }).delete();
  await releaseReservedStorageForUser(params.userId, params.reservedBytes).catch(
    () => undefined,
  );
}

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
    const parsed = completeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const file = await getOwnedFileIncludingPending(user.id, parsed.data.fileId);

    if (!file) {
      return notFoundResponse();
    }

    const filenameValidation = validateUploadFilename(file.name);
    if (!filenameValidation.ok) {
      await cleanupPendingUpload({
        userId: user.id,
        fileId: file.id,
        storageKey: file.storageKey,
        reservedBytes: BigInt(file.size),
      });
      return NextResponse.json({ error: filenameValidation.reason }, { status: 415 });
    }

    if (file.status === 'READY') {
      return NextResponse.json({ fileId: file.id, status: file.status });
    }

    const metadata = await getObjectMetadata(file.storageKey);
    const reservedBytes = BigInt(file.size);

    const scanResult = await runAntivirusScanHook({
      userId: user.id,
      fileId: file.id,
      storageKey: file.storageKey,
      fileName: file.name,
      size: metadata.size,
      mimeType: file.mimeType,
    });

    if (scanResult.status === 'infected') {
      await cleanupPendingUpload({
        userId: user.id,
        fileId: file.id,
        storageKey: file.storageKey,
        reservedBytes,
      });
      return NextResponse.json({ error: 'File rejected by security policy' }, { status: 415 });
    }

    if (scanResult.status !== 'skipped' && scanResult.status !== 'clean') {
      console.info('Antivirus hook result', {
        fileId: file.id,
        userId: user.id,
        result: scanResult,
      });
    }

    const finalizeResult = await finalizePendingUpload({
      userId: user.id,
      fileId: file.id,
      actualSize: metadata.size,
    });

    if (!finalizeResult.ok) {
      if (finalizeResult.reason === 'quota_exceeded') {
        await cleanupPendingUpload({
          userId: user.id,
          fileId: file.id,
          storageKey: file.storageKey,
          reservedBytes,
        });
        return NextResponse.json({ error: 'Storage quota exceeded' }, { status: 403 });
      }

      return notFoundResponse();
    }

    return NextResponse.json({ fileId: file.id, status: 'READY' });
  } catch (completeError) {
    console.error('Upload completion failed', completeError);
    return NextResponse.json({ error: 'Unable to complete upload' }, { status: 500 });
  }
}
