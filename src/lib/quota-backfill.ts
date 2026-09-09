import { cache } from 'react';
import { orm } from '@/lib/db';
import {
  computeEffectiveLimitsForUser,
  currentBandwidthPeriodStart,
  normalizeMaxFileSizeBytes,
  normalizeMonthlyBandwidthLimitBytes,
  normalizeStorageQuota,
} from '@/lib/customer-limits';

async function ensureCustomerQuotaPersistedImpl(userId: string): Promise<void> {
  const user = await orm.User.where({ id: userId })
    .select(
      'assignedPlan',
      'storageQuota',
      'storageQuotaOverride',
      'maxFileSizeBytes',
      'maxFileSizeOverride',
      'monthlyBandwidthLimitBytes',
      'monthlyBandwidthLimitOverride',
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

  const layers = await computeEffectiveLimitsForUser({
    assignedPlan: user.assignedPlan,
    storageQuotaOverride: user.storageQuotaOverride,
    maxFileSizeOverride: user.maxFileSizeOverride,
    monthlyBandwidthLimitOverride: user.monthlyBandwidthLimitOverride,
  });

  if (
    user.storageQuotaOverride === null &&
    BigInt(user.storageQuota) !== layers.storage.effectiveBytes
  ) {
    updates.storageQuota = layers.storage.effectiveBytes;
  }

  if (
    user.maxFileSizeOverride === null &&
    BigInt(user.maxFileSizeBytes) !== layers.maxFileSize.effectiveBytes
  ) {
    updates.maxFileSizeBytes = layers.maxFileSize.effectiveBytes;
  }

  if (
    user.monthlyBandwidthLimitOverride === null &&
    BigInt(user.monthlyBandwidthLimitBytes) !== layers.bandwidth.effectiveBytes
  ) {
    updates.monthlyBandwidthLimitBytes = layers.bandwidth.effectiveBytes;
  }

  if (Object.keys(updates).length > 0) {
    await orm.User.where({ id: userId }).update(updates);
  }
}

export const ensureCustomerQuotaPersisted = cache(ensureCustomerQuotaPersistedImpl);
