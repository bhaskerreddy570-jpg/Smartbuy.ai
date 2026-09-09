import { orm } from '@/lib/db';
import { resolveCustomerLimits, shouldResetBandwidthPeriod } from '@/lib/customer-limits';
import { ensureCustomerQuotaPersisted } from '@/lib/quota-backfill';
import { getCategoryLabel } from '@/lib/storage/categories';
import { applyFileSearchFilters, type FileSearchFilters } from '@/lib/files/search';
import { countReadyFilesByCategory } from '@/lib/storage/file-insights';
import { listDeletedFiles, listReadyFiles, listStarredFiles } from '@/lib/storage/files';
import { CUSTOMER_FILE_CATEGORIES, type FileCategory } from '@/lib/storage/types';
import { formatBytes } from '@/lib/storage/validation';

type StoredFileRecord = {
  id: string;
  name: string;
  originalName: string;
  size: bigint | number | string;
  mimeType: string;
  category: FileCategory;
  starred?: boolean | null;
  securityMode?: 'NORMAL' | 'SECURE' | null;
  encryptionFormatVersion?: string | null;
  encryptionAlgorithm?: string | null;
  encryptionKdf?: string | null;
  encryptionSalt?: string | null;
  plaintextSize?: bigint | number | string | null;
  createdAt: string;
  deletedAt?: string | null;
};

export function mapStoredFileToDashboardEntry(file: StoredFileRecord) {
  const storedSize = BigInt(file.size);
  const displaySize =
    file.securityMode === 'SECURE' &&
    file.plaintextSize !== null &&
    file.plaintextSize !== undefined
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
    deletedAt: file.deletedAt ?? null,
  };
}

function buildDashboardPayload(params: {
  limits: ReturnType<typeof resolveCustomerLimits>;
  bandwidthUsed: bigint;
  bandwidthRemaining: bigint;
  category: FileCategory | null | undefined;
  view: 'files' | 'starred' | 'trash';
  categoryCounts: Map<FileCategory, number>;
  files: StoredFileRecord[];
}) {
  return {
    storage: {
      quota: params.limits.storageQuota.toString(),
      used: params.limits.storageUsed.toString(),
      available: params.limits.storageRemaining.toString(),
      quotaLabel: formatBytes(params.limits.storageQuota),
      usedLabel: formatBytes(params.limits.storageUsed),
      availableLabel: formatBytes(params.limits.storageRemaining),
    },
    bandwidth: {
      limit: params.limits.monthlyBandwidthLimitBytes.toString(),
      used: params.bandwidthUsed.toString(),
      remaining: params.bandwidthRemaining.toString(),
      limitLabel: formatBytes(params.limits.monthlyBandwidthLimitBytes),
      usedLabel: formatBytes(params.bandwidthUsed),
      remainingLabel: formatBytes(params.bandwidthRemaining),
    },
    maxFileSize: {
      bytes: params.limits.maxFileSizeBytes.toString(),
      label: formatBytes(params.limits.maxFileSizeBytes),
    },
    activeCategory: params.category ?? null,
    view: params.view,
    categories: CUSTOMER_FILE_CATEGORIES.map((fileCategory) => ({
      id: fileCategory,
      label: getCategoryLabel(fileCategory),
      count: params.categoryCounts.get(fileCategory) ?? 0,
    })),
    files: params.files.map(mapStoredFileToDashboardEntry),
  };
}

export async function getDashboardSummary(userId: string) {
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
  const categoryCounts = await countReadyFilesByCategory(userId);

  return buildDashboardPayload({
    limits,
    bandwidthUsed,
    bandwidthRemaining,
    category: null,
    view: 'files',
    categoryCounts,
    files: [],
  });
}

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

  return buildDashboardPayload({
    limits,
    bandwidthUsed,
    bandwidthRemaining,
    category: category ?? null,
    view: options?.trash ? 'trash' : options?.starred ? 'starred' : 'files',
    categoryCounts,
    files,
  });
}

export type DashboardData = NonNullable<Awaited<ReturnType<typeof getDashboardData>>>;
