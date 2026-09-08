import { appConfig } from '@/lib/config';

export type CustomerLimitFields = {
  storageQuota: bigint | number | string;
  storageUsed: bigint | number | string;
  maxFileSizeBytes: bigint | number | string;
  monthlyBandwidthLimitBytes: bigint | number | string;
  monthlyBandwidthUsedBytes: bigint | number | string;
  bandwidthPeriodStart: string | null;
};

function toBigInt(value: bigint | number | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

export function normalizeStorageQuota(value: bigint | number | string): bigint {
  const quota = toBigInt(value);
  if (quota <= 0n) {
    return appConfig.defaultStorageQuotaBytes;
  }
  return quota;
}

export function normalizeMaxFileSizeBytes(value: bigint | number | string): bigint {
  const limit = toBigInt(value);
  if (limit <= 0n) {
    return appConfig.defaultMaxFileSizeBytes;
  }
  return limit;
}

export function normalizeMonthlyBandwidthLimitBytes(
  value: bigint | number | string,
): bigint {
  const limit = toBigInt(value);
  if (limit <= 0n) {
    return appConfig.defaultMonthlyBandwidthLimitBytes;
  }
  return limit;
}

export function currentBandwidthPeriodStart(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

export function shouldResetBandwidthPeriod(
  periodStart: string | null,
  now = new Date(),
): boolean {
  if (!periodStart) {
    return true;
  }

  const start = new Date(periodStart);
  return (
    start.getUTCFullYear() !== now.getUTCFullYear() ||
    start.getUTCMonth() !== now.getUTCMonth()
  );
}

export function resolveCustomerLimits(user: CustomerLimitFields) {
  const storageQuota = normalizeStorageQuota(user.storageQuota);
  const storageUsed = toBigInt(user.storageUsed);
  const maxFileSizeBytes = normalizeMaxFileSizeBytes(user.maxFileSizeBytes);
  const monthlyBandwidthLimitBytes = normalizeMonthlyBandwidthLimitBytes(
    user.monthlyBandwidthLimitBytes,
  );
  const monthlyBandwidthUsedBytes = toBigInt(user.monthlyBandwidthUsedBytes);

  return {
    storageQuota,
    storageUsed,
    storageRemaining:
      storageQuota >= storageUsed ? storageQuota - storageUsed : 0n,
    maxFileSizeBytes,
    monthlyBandwidthLimitBytes,
    monthlyBandwidthUsedBytes,
    monthlyBandwidthRemaining:
      monthlyBandwidthLimitBytes >= monthlyBandwidthUsedBytes
        ? monthlyBandwidthLimitBytes - monthlyBandwidthUsedBytes
        : 0n,
    bandwidthPeriodStart: user.bandwidthPeriodStart,
  };
}

export function createDefaultCustomerLimits() {
  return {
    storageQuota: appConfig.defaultStorageQuotaBytes,
    maxFileSizeBytes: appConfig.defaultMaxFileSizeBytes,
    monthlyBandwidthLimitBytes: appConfig.defaultMonthlyBandwidthLimitBytes,
    monthlyBandwidthUsedBytes: BigInt(0),
    bandwidthPeriodStart: currentBandwidthPeriodStart(),
  };
}
