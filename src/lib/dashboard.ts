import { orm } from '@/lib/db';
import { resolveCustomerLimits, shouldResetBandwidthPeriod } from '@/lib/customer-limits';
import { getCategoryLabel } from '@/lib/storage/categories';
import { listReadyFiles } from '@/lib/storage/files';
import { FILE_CATEGORIES, type FileCategory } from '@/lib/storage/types';
import { formatBytes } from '@/lib/storage/validation';

export async function getDashboardData(
  userId: string,
  category?: FileCategory,
) {
  const user = await orm.User.where({ id: userId })
    .select(
      'storageQuota',
      'storageUsed',
      'maxFileSizeBytes',
      'monthlyBandwidthLimitBytes',
      'monthlyBandwidthUsedBytes',
      'bandwidthPeriodStart',
    )
    .first();

  if (!user) {
    return null;
  }

  const limits = resolveCustomerLimits(user);
  const bandwidthUsed = shouldResetBandwidthPeriod(user.bandwidthPeriodStart)
    ? 0n
    : limits.monthlyBandwidthUsedBytes;
  const bandwidthRemaining =
    limits.monthlyBandwidthLimitBytes >= bandwidthUsed
      ? limits.monthlyBandwidthLimitBytes - bandwidthUsed
      : 0n;

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
      quota: limits.storageQuota.toString(),
      used: limits.storageUsed.toString(),
      available: limits.storageRemaining.toString(),
      quotaLabel: formatBytes(limits.storageQuota),
      usedLabel: formatBytes(limits.storageUsed),
      availableLabel: formatBytes(limits.storageRemaining),
    },
    bandwidth: {
      limit: limits.monthlyBandwidthLimitBytes.toString(),
      used: bandwidthUsed.toString(),
      remaining: bandwidthRemaining.toString(),
      limitLabel: formatBytes(limits.monthlyBandwidthLimitBytes),
      usedLabel: formatBytes(bandwidthUsed),
      remainingLabel: formatBytes(bandwidthRemaining),
    },
    maxFileSize: {
      bytes: limits.maxFileSizeBytes.toString(),
      label: formatBytes(limits.maxFileSizeBytes),
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
      size: BigInt(file.size).toString(),
      sizeLabel: formatBytes(BigInt(file.size)),
      mimeType: file.mimeType,
      category: file.category,
      categoryLabel: getCategoryLabel(file.category),
      createdAt: file.createdAt,
    })),
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
