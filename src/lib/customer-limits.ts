import { appConfig } from '@/lib/config';
import {
  getPlanConfiguration,
  listPlanConfigurations,
  type Plan,
  type PlanLimitConfiguration,
} from '@/lib/plan-configuration';
import { orm } from '@/lib/db';

export type { Plan };

export type CustomerLimitFields = {
  storageQuota: bigint | number | string;
  storageUsed: bigint | number | string;
  maxFileSizeBytes: bigint | number | string;
  monthlyBandwidthLimitBytes: bigint | number | string;
  monthlyBandwidthUsedBytes: bigint | number | string;
  bandwidthPeriodStart: string | null;
};

export type CustomerLimitAssignmentFields = {
  assignedPlan: Plan;
  storageQuotaOverride?: bigint | number | string | null;
  maxFileSizeOverride?: bigint | number | string | null;
  monthlyBandwidthLimitOverride?: bigint | number | string | null;
};

export type LimitLayer = {
  bytes: bigint;
  labelSource: 'override' | 'plan' | 'system_default';
};

export type ResolvedLimitLayers = {
  storage: {
    planBytes: bigint;
    overrideBytes: bigint | null;
    effectiveBytes: bigint;
    effectiveSource: LimitLayer['labelSource'];
  };
  maxFileSize: {
    planBytes: bigint;
    overrideBytes: bigint | null;
    effectiveBytes: bigint;
    effectiveSource: LimitLayer['labelSource'];
  };
  bandwidth: {
    planBytes: bigint;
    overrideBytes: bigint | null;
    effectiveBytes: bigint;
    effectiveSource: LimitLayer['labelSource'];
  };
};

function toBigInt(value: bigint | number | string): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}

function toNullableBigInt(
  value: bigint | number | string | null | undefined,
): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  return toBigInt(value);
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

export function resolveEffectiveLimit(params: {
  override: bigint | null;
  planLimit: bigint;
  systemDefault: bigint;
}): { effective: bigint; source: LimitLayer['labelSource'] } {
  if (params.override !== null) {
    return {
      effective: normalizeStorageQuota(params.override),
      source: 'override',
    };
  }

  if (params.planLimit > 0n) {
    return {
      effective: params.planLimit,
      source: 'plan',
    };
  }

  return {
    effective: params.systemDefault,
    source: 'system_default',
  };
}

export function resolveEffectiveMaxFileSize(params: {
  override: bigint | null;
  planLimit: bigint;
  systemDefault: bigint;
}): { effective: bigint; source: LimitLayer['labelSource'] } {
  if (params.override !== null) {
    return {
      effective: normalizeMaxFileSizeBytes(params.override),
      source: 'override',
    };
  }

  if (params.planLimit > 0n) {
    return {
      effective: params.planLimit,
      source: 'plan',
    };
  }

  return {
    effective: params.systemDefault,
    source: 'system_default',
  };
}

export function resolveEffectiveBandwidthLimit(params: {
  override: bigint | null;
  planLimit: bigint;
  systemDefault: bigint;
}): { effective: bigint; source: LimitLayer['labelSource'] } {
  if (params.override !== null) {
    return {
      effective: normalizeMonthlyBandwidthLimitBytes(params.override),
      source: 'override',
    };
  }

  if (params.planLimit > 0n) {
    return {
      effective: params.planLimit,
      source: 'plan',
    };
  }

  return {
    effective: params.systemDefault,
    source: 'system_default',
  };
}

export function resolveLimitLayers(
  assignment: CustomerLimitAssignmentFields,
  planConfig: PlanLimitConfiguration,
): ResolvedLimitLayers {
  const storage = resolveEffectiveLimit({
    override: toNullableBigInt(assignment.storageQuotaOverride),
    planLimit: planConfig.storageQuotaBytes,
    systemDefault: appConfig.defaultStorageQuotaBytes,
  });
  const maxFileSize = resolveEffectiveMaxFileSize({
    override: toNullableBigInt(assignment.maxFileSizeOverride),
    planLimit: planConfig.maxFileSizeBytes,
    systemDefault: appConfig.defaultMaxFileSizeBytes,
  });
  const bandwidth = resolveEffectiveBandwidthLimit({
    override: toNullableBigInt(assignment.monthlyBandwidthLimitOverride),
    planLimit: planConfig.monthlyBandwidthLimitBytes,
    systemDefault: appConfig.defaultMonthlyBandwidthLimitBytes,
  });

  return {
    storage: {
      planBytes: planConfig.storageQuotaBytes,
      overrideBytes: toNullableBigInt(assignment.storageQuotaOverride),
      effectiveBytes: storage.effective,
      effectiveSource: storage.source,
    },
    maxFileSize: {
      planBytes: planConfig.maxFileSizeBytes,
      overrideBytes: toNullableBigInt(assignment.maxFileSizeOverride),
      effectiveBytes: maxFileSize.effective,
      effectiveSource: maxFileSize.source,
    },
    bandwidth: {
      planBytes: planConfig.monthlyBandwidthLimitBytes,
      overrideBytes: toNullableBigInt(assignment.monthlyBandwidthLimitOverride),
      effectiveBytes: bandwidth.effective,
      effectiveSource: bandwidth.source,
    },
  };
}

export async function computeEffectiveLimitsForUser(
  assignment: CustomerLimitAssignmentFields,
): Promise<ResolvedLimitLayers> {
  const planConfig = await getPlanConfiguration(assignment.assignedPlan);
  return resolveLimitLayers(assignment, planConfig);
}

export async function recomputeAndPersistUserEffectiveLimits(
  userId: string,
): Promise<ResolvedLimitLayers | null> {
  const user = await orm.User.where({ id: userId })
    .select(
      'assignedPlan',
      'storageQuotaOverride',
      'maxFileSizeOverride',
      'monthlyBandwidthLimitOverride',
    )
    .first();

  if (!user) {
    return null;
  }

  const layers = await computeEffectiveLimitsForUser({
    assignedPlan: user.assignedPlan,
    storageQuotaOverride: user.storageQuotaOverride,
    maxFileSizeOverride: user.maxFileSizeOverride,
    monthlyBandwidthLimitOverride: user.monthlyBandwidthLimitOverride,
  });

  await orm.User.where({ id: userId }).update({
    storageQuota: layers.storage.effectiveBytes,
    maxFileSizeBytes: layers.maxFileSize.effectiveBytes,
    monthlyBandwidthLimitBytes: layers.bandwidth.effectiveBytes,
  });

  return layers;
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

export async function createPlanBasedCustomerLimits(plan: Plan = 'FREE') {
  const layers = await computeEffectiveLimitsForUser({
    assignedPlan: plan,
    storageQuotaOverride: null,
    maxFileSizeOverride: null,
    monthlyBandwidthLimitOverride: null,
  });

  return {
    assignedPlan: plan,
    storageQuota: layers.storage.effectiveBytes,
    maxFileSizeBytes: layers.maxFileSize.effectiveBytes,
    monthlyBandwidthLimitBytes: layers.bandwidth.effectiveBytes,
    monthlyBandwidthUsedBytes: BigInt(0),
    bandwidthPeriodStart: currentBandwidthPeriodStart(),
  };
}
