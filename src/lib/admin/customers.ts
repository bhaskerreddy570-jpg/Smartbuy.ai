import { orm } from '@/lib/db';
import {
  normalizeMaxFileSizeBytes,
  normalizeMonthlyBandwidthLimitBytes,
  normalizeStorageQuota,
  resolveCustomerLimits,
  shouldResetBandwidthPeriod,
} from '@/lib/customer-limits';
import { getCustomerStorageUsageByCategory } from '@/lib/storage/category-usage';
import { formatBytes } from '@/lib/storage/validation';
import { isCustomerAccountLocked } from '@/lib/admin/customer-accounts';

export type AdminCustomerSummary = {
  id: string;
  name: string | null;
  email: string;
  status: 'Active' | 'Locked';
  storageUsed: string;
  storageUsedLabel: string;
  storageQuota: string;
  storageQuotaLabel: string;
  storageRemaining: string;
  storageRemainingLabel: string;
  bandwidthUsed: string;
  bandwidthUsedLabel: string;
  bandwidthLimit: string;
  bandwidthLimitLabel: string;
  bandwidthRemaining: string;
  bandwidthRemainingLabel: string;
  maxFileSizeBytes: string;
  maxFileSizeLabel: string;
  fileCount: number;
};

export type AdminCustomerDetail = AdminCustomerSummary & {
  lockReason: string | null;
  categories: Array<{
    category: string;
    label: string;
    bytesUsed: string;
    bytesLabel: string;
    fileCount: number;
  }>;
};

function toSummary(user: {
  id: string;
  name: string | null;
  email: string;
  storageQuota: bigint | number | string;
  storageUsed: bigint | number | string;
  maxFileSizeBytes: bigint | number | string;
  monthlyBandwidthLimitBytes: bigint | number | string;
  monthlyBandwidthUsedBytes: bigint | number | string;
  bandwidthPeriodStart: string | null;
  lockedAt: string | null;
  lockReason: string | null;
}, fileCount: number): AdminCustomerSummary {
  const limits = resolveCustomerLimits(user);
  const bandwidthUsed = shouldResetBandwidthPeriod(user.bandwidthPeriodStart)
    ? 0n
    : limits.monthlyBandwidthUsedBytes;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: isCustomerAccountLocked(user) ? 'Locked' : 'Active',
    storageUsed: limits.storageUsed.toString(),
    storageUsedLabel: formatBytes(limits.storageUsed),
    storageQuota: limits.storageQuota.toString(),
    storageQuotaLabel: formatBytes(limits.storageQuota),
    storageRemaining: limits.storageRemaining.toString(),
    storageRemainingLabel: formatBytes(limits.storageRemaining),
    bandwidthUsed: bandwidthUsed.toString(),
    bandwidthUsedLabel: formatBytes(bandwidthUsed),
    bandwidthLimit: limits.monthlyBandwidthLimitBytes.toString(),
    bandwidthLimitLabel: formatBytes(limits.monthlyBandwidthLimitBytes),
    bandwidthRemaining: (
      limits.monthlyBandwidthLimitBytes >= bandwidthUsed
        ? limits.monthlyBandwidthLimitBytes - bandwidthUsed
        : 0n
    ).toString(),
    bandwidthRemainingLabel: formatBytes(
      limits.monthlyBandwidthLimitBytes >= bandwidthUsed
        ? limits.monthlyBandwidthLimitBytes - bandwidthUsed
        : 0n,
    ),
    maxFileSizeBytes: limits.maxFileSizeBytes.toString(),
    maxFileSizeLabel: formatBytes(limits.maxFileSizeBytes),
    fileCount,
  };
}

export async function listAdminCustomers(): Promise<AdminCustomerSummary[]> {
  const users = await orm.User.select(
    'id',
    'name',
    'email',
    'storageQuota',
    'storageUsed',
    'maxFileSizeBytes',
    'monthlyBandwidthLimitBytes',
    'monthlyBandwidthUsedBytes',
    'bandwidthPeriodStart',
    'lockedAt',
    'lockReason',
  )
    .orderBy((user) => user.createdAt.desc())
    .all();

  const summaries: AdminCustomerSummary[] = [];

  for (const user of users) {
    const usage = await getCustomerStorageUsageByCategory(user.id);
    const fileCount =
      usage?.categories.reduce((total, category) => total + category.fileCount, 0) ??
      0;
    summaries.push(toSummary(user, fileCount));
  }

  return summaries;
}

export async function getAdminCustomerDetail(
  userId: string,
): Promise<AdminCustomerDetail | null> {
  const user = await orm.User.where({ id: userId })
    .select(
      'id',
      'name',
      'email',
      'storageQuota',
      'storageUsed',
      'maxFileSizeBytes',
      'monthlyBandwidthLimitBytes',
      'monthlyBandwidthUsedBytes',
      'bandwidthPeriodStart',
      'lockedAt',
      'lockReason',
    )
    .first();

  if (!user) {
    return null;
  }

  const usage = await getCustomerStorageUsageByCategory(userId);
  if (!usage) {
    return null;
  }

  const fileCount = usage.categories.reduce(
    (total, category) => total + category.fileCount,
    0,
  );

  return {
    ...toSummary(user, fileCount),
    lockReason: user.lockReason,
    categories: usage.categories.map((category) => ({
      category: category.category,
      label: category.label,
      bytesUsed: category.bytesUsed.toString(),
      bytesLabel: category.bytesLabel,
      fileCount: category.fileCount,
    })),
  };
}

export async function updateAdminCustomerLimits(params: {
  userId: string;
  storageQuotaBytes?: bigint;
  maxFileSizeBytes?: bigint;
  monthlyBandwidthLimitBytes?: bigint;
}): Promise<AdminCustomerDetail | null> {
  const user = await orm.User.where({ id: params.userId }).first();
  if (!user) {
    return null;
  }

  const updates: Record<string, bigint> = {};

  if (params.storageQuotaBytes !== undefined) {
    updates.storageQuota = normalizeStorageQuota(params.storageQuotaBytes);
  }
  if (params.maxFileSizeBytes !== undefined) {
    updates.maxFileSizeBytes = normalizeMaxFileSizeBytes(params.maxFileSizeBytes);
  }
  if (params.monthlyBandwidthLimitBytes !== undefined) {
    updates.monthlyBandwidthLimitBytes = normalizeMonthlyBandwidthLimitBytes(
      params.monthlyBandwidthLimitBytes,
    );
  }

  if (Object.keys(updates).length > 0) {
    await orm.User.where({ id: params.userId }).update(updates);

    if (updates.storageQuota !== undefined) {
      const subscription = await orm.Subscription.where({ userId: params.userId })
        .select('id')
        .first();
      if (subscription) {
        await orm.Subscription.where({ id: subscription.id }).update({
          storageQuota: updates.storageQuota,
        });
      }
    }
  }

  return getAdminCustomerDetail(params.userId);
}
