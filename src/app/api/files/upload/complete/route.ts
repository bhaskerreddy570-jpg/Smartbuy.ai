import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthUser } from '@/lib/api/auth';
import { resolveCustomerLimits } from '@/lib/customer-limits';
import { orm } from '@/lib/db';
import { mapStoredFileToDashboardEntry } from '@/lib/dashboard';
import { logPerformanceSpans, measureAsync, type PerformanceSpan } from '@/lib/performance/timing';
import { recordCustomerSecurityEvent } from '@/lib/security/customer-events';
import { runAntivirusScanHook } from '@/lib/storage/antivirus';
import { resolveOwnedFileStorage } from '@/lib/storage/owned-file-storage';
import {
  getStorageService,
  toStorageObjectRef,
} from '@/lib/storage/storage-service';
import {
  finalizePendingUpload,
  releaseReservedStorageForUser,
} from '@/lib/storage/upload-lifecycle';
import { formatBytes } from '@/lib/storage/validation';
import { validateUploadFilename } from '@/lib/storage/validation';

const completeSchema = z
  .object({
    fileId: z.string().uuid(),
    clientUploadId: z.string().uuid().optional(),
  })
  .strict();

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

async function buildCompleteResponse(params: {
  userId: string;
  fileId: string;
  alreadyComplete: boolean;
}) {
  const [readyFile, userRecord] = await Promise.all([
    orm.File.where({ id: params.fileId, userId: params.userId }).first(),
    orm.User.where({ id: params.userId })
      .select(
        'storageQuota',
        'storageUsed',
        'maxFileSizeBytes',
        'monthlyBandwidthLimitBytes',
        'monthlyBandwidthUsedBytes',
        'bandwidthPeriodStart',
      )
      .first(),
  ]);

  if (!readyFile || !userRecord) {
    return {
      fileId: params.fileId,
      status: 'READY' as const,
      alreadyComplete: params.alreadyComplete,
    };
  }

  const limits = resolveCustomerLimits(userRecord);

  return {
    fileId: params.fileId,
    status: 'READY' as const,
    alreadyComplete: params.alreadyComplete,
    file: mapStoredFileToDashboardEntry(readyFile),
    storage: {
      quota: limits.storageQuota.toString(),
      used: limits.storageUsed.toString(),
      available: limits.storageRemaining.toString(),
      quotaLabel: formatBytes(limits.storageQuota),
      usedLabel: formatBytes(limits.storageUsed),
      availableLabel: formatBytes(limits.storageRemaining),
    },
  };
}

export async function POST(request: Request) {
  const spans: PerformanceSpan[] = [];
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

    const ownedResult = await measureAsync('resolve_pending_file', () =>
      resolveOwnedFileStorage({
        userId: user.id,
        fileId: parsed.data.fileId,
        mode: 'pending',
      }),
    );
    spans.push({ label: 'resolve_pending_file', durationMs: ownedResult.durationMs });
    const owned = ownedResult.result;

    if (!owned) {
      return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
    }

    const file = owned.file;

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
      const payload = await buildCompleteResponse({
        userId: user.id,
        fileId: file.id,
        alreadyComplete: true,
      });
      logPerformanceSpans('upload_complete', spans);
      return NextResponse.json(payload);
    }

    const headResult = await measureAsync('s3_head_object', () =>
      getStorageService().headObject(owned.objectRef),
    );
    spans.push({ label: 's3_head_object', durationMs: headResult.durationMs });
    const metadata = headResult.result;
    if (metadata.size <= 0n) {
      return NextResponse.json({ error: 'FILE_NOT_FOUND' }, { status: 404 });
    }
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

    const finalizeResult = await measureAsync('finalize_db', () =>
      finalizePendingUpload({
        userId: user.id,
        fileId: file.id,
        actualSize: metadata.size,
      }),
    );
    spans.push({ label: 'finalize_db', durationMs: finalizeResult.durationMs });

    if (!finalizeResult.result.ok) {
      if (finalizeResult.result.reason === 'quota_exceeded') {
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

    await recordCustomerSecurityEvent({
      userId: user.id,
      eventType: 'FILE_UPLOAD',
      metadata: { fileId: file.id, fileName: file.name, size: metadata.size.toString() },
    });

    const payload = await buildCompleteResponse({
      userId: user.id,
      fileId: file.id,
      alreadyComplete: finalizeResult.result.alreadyComplete,
    });

    logPerformanceSpans('upload_complete', spans);
    return NextResponse.json(payload);
  } catch (completeError) {
    console.error('Upload completion failed', completeError);
    return NextResponse.json({ error: 'Unable to complete upload' }, { status: 500 });
  }
}
