import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/api/auth';
import { orm } from '@/lib/db';
import { runAntivirusScanHook } from '@/lib/storage/antivirus';
import { assertStorageKeyOwnership } from '@/lib/storage/keys';
import { getOwnedFileIncludingPending } from '@/lib/storage/files';
import {
  getStorageService,
  toStorageObjectRef,
} from '@/lib/storage/storage-service';
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
  storageProvider: string;
  storageNamespace: string;
  reservedBytes: bigint;
}): Promise<void> {
  await getStorageService()
    .deleteObject(
      toStorageObjectRef({
        storageKey: params.storageKey,
        storageProvider: params.storageProvider,
        storageNamespace: params.storageNamespace,
      }),
    )
    .catch(() => undefined);
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

    if (
      !file ||
      !assertStorageKeyOwnership({
        storageKey: file.storageKey,
        userId: user.id,
        category: file.category,
      })
    ) {
      return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
    }

    const filenameValidation = validateUploadFilename(file.name);
    if (!filenameValidation.ok) {
      await cleanupPendingUpload({
        userId: user.id,
        fileId: file.id,
        storageKey: file.storageKey,
        storageProvider: file.storageProvider,
        storageNamespace: file.storageNamespace,
        reservedBytes: BigInt(file.size),
      });
      return NextResponse.json({ error: filenameValidation.reason }, { status: 415 });
    }

    if (file.status === 'READY') {
      return NextResponse.json({ fileId: file.id, status: file.status });
    }

    const objectRef = toStorageObjectRef(file);
    const metadata = await getStorageService().headObject(objectRef);
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
        storageProvider: file.storageProvider,
        storageNamespace: file.storageNamespace,
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
          storageProvider: file.storageProvider,
          storageNamespace: file.storageNamespace,
          reservedBytes,
        });
        return NextResponse.json({ error: 'STORAGE_QUOTA_EXCEEDED' }, { status: 403 });
      }

      return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({ fileId: file.id, status: 'READY' });
  } catch (completeError) {
    console.error('Upload completion failed', completeError);
    return NextResponse.json({ error: 'Unable to complete upload' }, { status: 500 });
  }
}
