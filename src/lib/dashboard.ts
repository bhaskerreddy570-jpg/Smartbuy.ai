import { orm } from '@/lib/db';
import { formatBytes } from '@/lib/storage/validation';
import { listReadyFiles } from '@/lib/storage/files';

function toBigInt(value: bigint | number | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

export async function getDashboardData(userId: string) {
  const user = await orm.User.where({ id: userId })
    .select('storageQuota', 'storageUsed')
    .first();

  if (!user) {
    return null;
  }

  const storageQuota = toBigInt(user.storageQuota);
  const storageUsed = toBigInt(user.storageUsed);
  const files = await listReadyFiles(userId);

  return {
    storage: {
      quota: storageQuota.toString(),
      used: storageUsed.toString(),
      available: (storageQuota - storageUsed).toString(),
      quotaLabel: formatBytes(storageQuota),
      usedLabel: formatBytes(storageUsed),
      availableLabel: formatBytes(storageQuota - storageUsed),
    },
    files: files.map((file) => ({
      id: file.id,
      name: file.name,
      originalName: file.originalName,
      size: toBigInt(file.size).toString(),
      sizeLabel: formatBytes(toBigInt(file.size)),
      mimeType: file.mimeType,
      createdAt: file.createdAt,
    })),
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
