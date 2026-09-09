import { orm } from '@/lib/db';
import { resolveCustomerLimits, shouldResetBandwidthPeriod } from '@/lib/customer-limits';
import { ensureCustomerQuotaPersisted } from '@/lib/quota-backfill';
import { getCategoryLabel } from '@/lib/storage/categories';
import { applyFileSearchFilters, type FileSearchFilters } from '@/lib/files/search';
import { countReadyFilesByCategory } from '@/lib/storage/file-insights';
import { listDeletedFiles, listReadyFiles, listStarredFiles } from '@/lib/storage/files';
import { CUSTOMER_FILE_CATEGORIES, type FileCategory } from '@/lib/storage/types';
import { formatBytes } from '@/lib/storage/validation';

export async function getDashboardData(
  userId: string,
  options?: {
    category?: FileCategory;
    starred?: boolean;
    trash?: boolean;
    search?: FileSearchFilters;
  },
) {
  await ensureCustomerQuotaPersisted(userId);

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

  const category = options?.category ?? options?.search?.category;

  const [categoryCounts, sourceFilesList] = await Promise.all([
    countReadyFilesByCategory(userId),
    options?.trash
      ? listDeletedFiles(userId)
      : options?.starred
        ? listStarredFiles(userId)
        : listReadyFiles(userId, category),
  ]);
  const sourceFiles = sourceFilesList;
  let files =
    category && !options?.trash && !options?.starred
      ? sourceFiles
      : category
        ? sourceFiles.filter((file) => file.category === category)
        : sourceFiles;

  if (options?.search) {
    const searchable = files.map((file) => ({
      id: file.id,
      name: file.name,
      category: file.category,
      starred: Boolean(file.starred),
      securityMode: (file.securityMode ?? 'NORMAL') as 'NORMAL' | 'SECURE',
      size: file.size.toString(),
      createdAt: file.createdAt,
    }));
    const filteredIds = new Set(
      applyFileSearchFilters(searchable, options.search).map((entry) => entry.id),
    );
    files = files.filter((file) => filteredIds.has(file.id));
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
    view: options?.trash ? 'trash' : options?.starred ? 'starred' : 'files',
    categories: CUSTOMER_FILE_CATEGORIES.map((fileCategory) => ({
      id: fileCategory,
      label: getCategoryLabel(fileCategory),
      count: categoryCounts.get(fileCategory) ?? 0,
    })),
    files: files.map((file) => {
      const storedSize = BigInt(file.size);
      const displaySize =
        file.securityMode === 'SECURE' && file.plaintextSize !== null
          ? BigInt(file.plaintextSize)
          : storedSize;

      return {
        id: file.id,
        name: file.name,
        originalName: file.originalName,
        size: storedSize.toString(),
        sizeLabel: formatBytes(displaySize),
        storedSizeLabel:
          file.securityMode === 'SECURE' ? formatBytes(storedSize) : undefined,
        mimeType: file.mimeType,
        category: file.category,
        categoryLabel: getCategoryLabel(file.category),
        starred: Boolean(file.starred),
        securityMode: file.securityMode ?? 'NORMAL',
        isSecure: file.securityMode === 'SECURE',
        encryption:
          file.securityMode === 'SECURE'
            ? {
                formatVersion: file.encryptionFormatVersion,
                algorithm: file.encryptionAlgorithm,
                kdf: file.encryptionKdf,
                hasPassphraseSalt: Boolean(file.encryptionSalt),
              }
            : null,
        createdAt: file.createdAt,
        deletedAt: file.deletedAt,
      };
    }),
  };
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
