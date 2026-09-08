import { orm } from '@/lib/db';
import {
  normalizeMaxFileSizeBytes,
  normalizeMonthlyBandwidthLimitBytes,
  normalizeStorageQuota,
  currentBandwidthPeriodStart,
} from '@/lib/customer-limits';

export async function ensureCustomerQuotaPersisted(userId: string): Promise<void> {
  const user = await orm.User.where({ id: userId })
    .select(
      'storageQuota',
      'maxFileSizeBytes',
      'monthlyBandwidthLimitBytes',
      'bandwidthPeriodStart',
    )
    .first();

  if (!user) {
    return;
  }

  const updates: Record<string, bigint | string> = {};
  const storageQuota = normalizeStorageQuota(user.storageQuota);
  if (BigInt(user.storageQuota) <= 0n) {
    updates.storageQuota = storageQuota;
  }

  const maxFileSizeBytes = normalizeMaxFileSizeBytes(user.maxFileSizeBytes);
  if (BigInt(user.maxFileSizeBytes) <= 0n) {
    updates.maxFileSizeBytes = maxFileSizeBytes;
  }

  const monthlyBandwidthLimitBytes = normalizeMonthlyBandwidthLimitBytes(
    user.monthlyBandwidthLimitBytes,
  );
  if (BigInt(user.monthlyBandwidthLimitBytes) <= 0n) {
    updates.monthlyBandwidthLimitBytes = monthlyBandwidthLimitBytes;
  }

  if (!user.bandwidthPeriodStart) {
    updates.bandwidthPeriodStart = currentBandwidthPeriodStart();
  }

  if (Object.keys(updates).length > 0) {
    await orm.User.where({ id: userId }).update(updates);
  }
}
