import { orm } from '@/lib/db';
import {
  resolveCustomerLimits,
  shouldResetBandwidthPeriod,
} from '@/lib/customer-limits';
import { isCustomerAccountLocked } from '@/lib/admin/customer-accounts';
import { formatBytes } from '@/lib/storage/validation';

export type AdminOverviewStats = {
  totalCustomers: number;
  activeCustomers: number;
  lockedCustomers: number;
  totalAllocatedStorage: string;
  totalAllocatedStorageLabel: string;
  totalStorageUsed: string;
  totalStorageUsedLabel: string;
  totalStorageRemaining: string;
  totalStorageRemainingLabel: string;
  totalBandwidthUsed: string;
  totalBandwidthUsedLabel: string;
  totalBandwidthLimit: string;
  totalBandwidthLimitLabel: string;
  recentActivity: Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    createdAt: string;
  }>;
};

export async function getAdminOverviewStats(): Promise<AdminOverviewStats> {
  const users = await orm.User.select(
    'storageQuota',
    'storageUsed',
    'maxFileSizeBytes',
    'monthlyBandwidthLimitBytes',
    'monthlyBandwidthUsedBytes',
    'bandwidthPeriodStart',
    'lockedAt',
  ).all();

  let totalAllocated = 0n;
  let totalUsed = 0n;
  let totalBandwidthUsed = 0n;
  let totalBandwidthLimit = 0n;
  let activeCustomers = 0;
  let lockedCustomers = 0;

  for (const user of users) {
    if (isCustomerAccountLocked(user)) {
      lockedCustomers += 1;
    } else {
      activeCustomers += 1;
    }

    const limits = resolveCustomerLimits(user);
    totalAllocated += limits.storageQuota;
    totalUsed += limits.storageUsed;
    totalBandwidthLimit += limits.monthlyBandwidthLimitBytes;

    const bandwidthUsed = shouldResetBandwidthPeriod(user.bandwidthPeriodStart)
      ? 0n
      : limits.monthlyBandwidthUsedBytes;
    totalBandwidthUsed += bandwidthUsed;
  }

  const totalRemaining =
    totalAllocated >= totalUsed ? totalAllocated - totalUsed : 0n;

  const logs = await orm.AdminAuditLog.select(
    'id',
    'action',
    'targetType',
    'targetId',
    'createdAt',
  ).all();

  const recentActivity = logs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10)
    .map((log) => ({
      id: log.id,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      createdAt: log.createdAt,
    }));

  return {
    totalCustomers: users.length,
    activeCustomers,
    lockedCustomers,
    totalAllocatedStorage: totalAllocated.toString(),
    totalAllocatedStorageLabel: formatBytes(totalAllocated),
    totalStorageUsed: totalUsed.toString(),
    totalStorageUsedLabel: formatBytes(totalUsed),
    totalStorageRemaining: totalRemaining.toString(),
    totalStorageRemainingLabel: formatBytes(totalRemaining),
    totalBandwidthUsed: totalBandwidthUsed.toString(),
    totalBandwidthUsedLabel: formatBytes(totalBandwidthUsed),
    totalBandwidthLimit: totalBandwidthLimit.toString(),
    totalBandwidthLimitLabel: formatBytes(totalBandwidthLimit),
    recentActivity,
  };
}
