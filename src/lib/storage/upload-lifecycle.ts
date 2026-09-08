import type { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { resolveCustomerLimits } from '@/lib/customer-limits';
import { getStorageService } from '@/lib/storage/storage-service';
import {
  normalizeSecureEncryptionMetadata,
  type SecureEncryptionMetadata,
} from '@/lib/storage/secure-upload-metadata';
import type { FileCategory } from '@/lib/storage/types';
import { DEFAULT_STORAGE_NAMESPACE } from '@/lib/storage/types';
import {
  reserveStorageBytes,
  setUserStorageUsed,
  withLockedUser,
} from '@/lib/storage/quota-reservation';
import { exceedsStorageQuota, adjustStorageUsedForActualSize } from '@/lib/storage/quota';

type PendingUploadRow = {
  id: string;
  userId: string;
  name: string;
  storageKey: string;
  size: string;
  status: 'PENDING' | 'READY';
  category: FileCategory;
  storageProvider: 'S3';
  storageNamespace: string;
};

export type CreatedPendingUpload = {
  fileId: string;
  storageKey: string;
  reservedBytes: bigint;
  category: FileCategory;
};

export type UploadFailureReason =
  | 'quota_exceeded'
  | 'not_found'
  | 'storage_unavailable'
  | 'database_unavailable';

function classifyUploadFailure(error: unknown): UploadFailureReason {
  if (error instanceof Error) {
    if (error.message === 'User not found') {
      return 'not_found';
    }

    if (
      error.message.includes('DATABASE_URL is not configured') ||
      error.message.includes('connection') ||
      error.message.includes('timeout')
    ) {
      return 'database_unavailable';
    }

    if (
      error.message.includes('AWS_S3_BUCKET') ||
      error.message.includes('S3') ||
      error.message.includes('storage')
    ) {
      return 'storage_unavailable';
    }
  }

  return 'storage_unavailable';
}

export async function createPendingUpload(params: {
  userId: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  uploadSize: bigint;
  category: FileCategory;
  secure?: boolean;
  encryption?: SecureEncryptionMetadata;
}): Promise<
  | { ok: true; file: CreatedPendingUpload }
  | { ok: false; reason: UploadFailureReason }
> {
  try {
    return await withLockedUser(params.userId, async (user, client) => {
      const reservation = reserveStorageBytes(user, params.uploadSize);
      if (!reservation.ok) {
        return { ok: false, reason: 'quota_exceeded' };
      }

      const fileId = randomUUID();
      const storageObjectId = randomUUID();
      const prepared = await getStorageService().prepareUpload({
        userId: params.userId,
        objectId: storageObjectId,
        category: params.category,
        size: params.uploadSize,
        namespace: DEFAULT_STORAGE_NAMESPACE,
      });

      const secure = params.secure === true;
      const encryptionFields = secure && params.encryption
        ? normalizeSecureEncryptionMetadata(params.encryption)
        : null;

      await client.query(
        `INSERT INTO file (
          id, "userId", name, "originalName", "storageKey", size, "mimeType", status,
          category, "storageProvider", "storageNamespace", "securityMode",
          "encryptionFormatVersion", "encryptionAlgorithm", "encryptionKdf",
          "encryptionSalt", "encryptionIv", "plaintextSize", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, 'S3', $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
        [
          fileId,
          params.userId,
          params.fileName,
          params.originalName,
          prepared.objectRef.key,
          params.uploadSize.toString(),
          params.mimeType,
          params.category,
          prepared.objectRef.namespace,
          secure ? 'SECURE' : 'NORMAL',
          encryptionFields?.encryptionFormatVersion ?? null,
          encryptionFields?.encryptionAlgorithm ?? null,
          encryptionFields?.encryptionKdf ?? null,
          encryptionFields?.encryptionSalt ?? null,
          encryptionFields?.encryptionIv ?? null,
          encryptionFields?.plaintextSize?.toString() ?? null,
        ],
      );

      await setUserStorageUsed(client, params.userId, reservation.nextStorageUsed);

      return {
        ok: true,
        file: {
          fileId,
          storageKey: prepared.objectRef.key,
          reservedBytes: params.uploadSize,
          category: params.category,
        },
      };
    });
  } catch (error) {
    console.error('createPendingUpload failed', {
      userId: params.userId,
      fileName: params.fileName,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: classifyUploadFailure(error) };
  }
}

export async function releaseReservedStorage(
  client: PoolClient,
  userId: string,
  reservedBytes: bigint,
): Promise<void> {
  const current = await client.query<{ storageUsed: string }>(
    'SELECT "storageUsed" FROM "user" WHERE id = $1 FOR UPDATE',
    [userId],
  );

  if (current.rowCount !== 1) {
    return;
  }

  const storageUsed = BigInt(current.rows[0].storageUsed);
  const nextUsed =
    storageUsed >= reservedBytes ? storageUsed - reservedBytes : BigInt(0);

  await setUserStorageUsed(client, userId, nextUsed);
}

export async function releaseReservedStorageForUser(
  userId: string,
  reservedBytes: bigint,
): Promise<void> {
  await withLockedUser(userId, async (_user, client) => {
    await releaseReservedStorage(client, userId, reservedBytes);
  });
}

export async function finalizePendingUpload(params: {
  userId: string;
  fileId: string;
  actualSize: bigint;
}): Promise<
  | { ok: true; status: 'READY'; alreadyComplete: boolean }
  | { ok: false; reason: 'not_found' | 'quota_exceeded' }
> {
  return withLockedUser(params.userId, async (user, client) => {
    const fileResult = await client.query<PendingUploadRow>(
      `SELECT id, "userId", name, "storageKey", size, status, category, "storageProvider", "storageNamespace"
       FROM file
       WHERE id = $1 AND "userId" = $2 AND "deletedAt" IS NULL
       FOR UPDATE`,
      [params.fileId, params.userId],
    );

    if (fileResult.rowCount !== 1) {
      return { ok: false, reason: 'not_found' };
    }

    const file = fileResult.rows[0];

    if (file.status === 'READY') {
      return { ok: true, status: 'READY', alreadyComplete: true };
    }

    const reservedSize = BigInt(file.size);
    const limits = resolveCustomerLimits(user);
    const sizeDelta = params.actualSize - reservedSize;
    const nextStorageUsed = adjustStorageUsedForActualSize(
      limits.storageUsed,
      reservedSize,
      params.actualSize,
    );

    if (
      sizeDelta > BigInt(0) &&
      exceedsStorageQuota(limits.storageUsed, sizeDelta, limits.storageQuota)
    ) {
      return { ok: false, reason: 'quota_exceeded' };
    }

    if (nextStorageUsed < BigInt(0)) {
      return { ok: false, reason: 'quota_exceeded' };
    }

    const updated = await client.query(
      `UPDATE file
       SET size = $1, status = 'READY', "updatedAt" = NOW()
       WHERE id = $2 AND "userId" = $3 AND status = 'PENDING'`,
      [params.actualSize.toString(), params.fileId, params.userId],
    );

    if (updated.rowCount !== 1) {
      const refreshed = await client.query<{ status: 'PENDING' | 'READY' }>(
        'SELECT status FROM file WHERE id = $1 AND "userId" = $2',
        [params.fileId, params.userId],
      );

      if (refreshed.rowCount === 1 && refreshed.rows[0].status === 'READY') {
        return { ok: true, status: 'READY', alreadyComplete: true };
      }

      return { ok: false, reason: 'not_found' };
    }

    await setUserStorageUsed(client, params.userId, nextStorageUsed);

    return { ok: true, status: 'READY', alreadyComplete: false };
  });
}

export { reserveStorageBytes };
