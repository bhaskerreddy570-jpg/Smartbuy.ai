import { orm } from '@/lib/db';
import { getCategoryLabel } from '@/lib/storage/categories';
import { listReadyFiles } from '@/lib/storage/files';
import { FILE_CATEGORIES, type FileCategory } from '@/lib/storage/types';
import { formatBytes } from '@/lib/storage/validation';

function toBigInt(value: bigint | number | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

export async function getDashboardData(
  userId: string,
  category?: FileCategory,
) {
  const user = await orm.User.where({ id: userId })
    .select('storageQuota', 'storageUsed')
    .first();

  if (!user) {
    return null;
  }

  const storageQuota = toBigInt(user.storageQuota);
  const storageUsed = toBigInt(user.storageUsed);
  const allFiles = await listReadyFiles(userId);
  const files = category
    ? allFiles.filter((file) => file.category === category)
    : allFiles;

  const countsByCategory = new Map<FileCategory, number>();
  for (const fileCategory of FILE_CATEGORIES) {
    countsByCategory.set(fileCategory, 0);
  }
  for (const file of allFiles) {
    countsByCategory.set(
      file.category,
      (countsByCategory.get(file.category) ?? 0) + 1,
    );
  }

  return {
    storage: {
      quota: storageQuota.toString(),
      used: storageUsed.toString(),
      available: (storageQuota - storageUsed).toString(),
      quotaLabel: formatBytes(storageQuota),
      usedLabel: formatBytes(storageUsed),
      availableLabel: formatBytes(storageQuota - storageUsed),
    },
    activeCategory: category ?? null,
    categories: FILE_CATEGORIES.map((fileCategory) => ({
      id: fileCategory,
      label: getCategoryLabel(fileCategory),
      count: countsByCategory.get(fileCategory) ?? 0,
    })),
    files: files.map((file) => ({
      id: file.id,
      name: file.name,
      originalName: file.originalName,
      size: toBigInt(file.size).toString(),
      sizeLabel: formatBytes(toBigInt(file.size)),
      mimeType: file.mimeType,
      category: file.category,
      categoryLabel: getCategoryLabel(file.category),
      createdAt: file.createdAt,
    })),
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
