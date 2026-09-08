import { orm } from '@/lib/db';
import {
  recomputeAndPersistUserEffectiveLimits,
  resolveCustomerLimits,
  resolveLimitLayers,
  shouldResetBandwidthPeriod,
  type Plan,
} from '@/lib/customer-limits';
import {
  getPlanConfiguration,
  listPlanConfigurations,
  syncUserSubscriptionPlan,
} from '@/lib/plan-configuration';
import { getCustomerStorageUsageByCategory } from '@/lib/storage/category-usage';
import { formatBytes } from '@/lib/storage/validation';
import { isCustomerAccountLocked } from '@/lib/admin/customer-accounts';

export type AdminLimitLayerView = {
  planBytes: string;
  planLabel: string;
  overrideBytes: string | null;
  overrideLabel: string | null;
  effectiveBytes: string;
  effectiveLabel: string;
  effectiveSource: 'override' | 'plan' | 'system_default';
};

export type AdminCustomerSummary = {
  id: string;
  name: string | null;
  email: string;
  status: 'Active' | 'Locked';
  assignedPlan: Plan;
  assignedPlanLabel: string;
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
  storageLimits: AdminLimitLayerView;
  maxFileSizeLimits: AdminLimitLayerView;
  bandwidthLimits: AdminLimitLayerView;
  categories: Array<{
    category: string;
    label: string;
    bytesUsed: string;
    bytesLabel: string;
    fileCount: number;
  }>;
};

function formatLayerView(
  layers: ReturnType<typeof resolveLimitLayers>['storage'],
): AdminLimitLayerView {
  return {
    planBytes: layers.planBytes.toString(),
    planLabel: formatBytes(layers.planBytes),
    overrideBytes: layers.overrideBytes?.toString() ?? null,
    overrideLabel:
      layers.overrideBytes !== null ? formatBytes(layers.overrideBytes) : null,
    effectiveBytes: layers.effectiveBytes.toString(),
    effectiveLabel: formatBytes(layers.effectiveBytes),
    effectiveSource: layers.effectiveSource,
  };
}

async function toSummary(
  user: {
    id: string;
    name: string | null;
    email: string;
    assignedPlan: Plan;
    storageQuotaOverride: bigint | number | string | null;
    maxFileSizeOverride: bigint | number | string | null;
    monthlyBandwidthLimitOverride: bigint | number | string | null;
    storageQuota: bigint | number | string;
    storageUsed: bigint | number | string;
    maxFileSizeBytes: bigint | number | string;
    monthlyBandwidthLimitBytes: bigint | number | string;
    monthlyBandwidthUsedBytes: bigint | number | string;
    bandwidthPeriodStart: string | null;
    lockedAt: string | null;
    lockReason: string | null;
  },
  fileCount: number,
): Promise<AdminCustomerSummary> {
  const planConfig = await getPlanConfiguration(user.assignedPlan);
  const limits = resolveCustomerLimits(user);
  const bandwidthUsed = shouldResetBandwidthPeriod(user.bandwidthPeriodStart)
    ? 0n
    : limits.monthlyBandwidthUsedBytes;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    status: isCustomerAccountLocked(user) ? 'Locked' : 'Active',
    assignedPlan: user.assignedPlan,
    assignedPlanLabel: planConfig.displayName,
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

async function toDetail(
  user: NonNullable<Awaited<ReturnType<typeof loadCustomerRecord>>>,
  fileCount: number,
  categories: AdminCustomerDetail['categories'],
): Promise<AdminCustomerDetail> {
  const planConfig = await getPlanConfiguration(user.assignedPlan);
  const layers = resolveLimitLayers(
    {
      assignedPlan: user.assignedPlan,
      storageQuotaOverride: user.storageQuotaOverride,
      maxFileSizeOverride: user.maxFileSizeOverride,
      monthlyBandwidthLimitOverride: user.monthlyBandwidthLimitOverride,
    },
    planConfig,
  );

  return {
    ...(await toSummary(user, fileCount)),
    lockReason: user.lockReason,
    storageLimits: formatLayerView(layers.storage),
    maxFileSizeLimits: formatLayerView(layers.maxFileSize),
    bandwidthLimits: formatLayerView(layers.bandwidth),
    categories,
  };
}

async function loadCustomerRecord(userId: string) {
  return orm.User.where({ id: userId })
    .select(
      'id',
      'name',
      'email',
      'assignedPlan',
      'storageQuotaOverride',
      'maxFileSizeOverride',
      'monthlyBandwidthLimitOverride',
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
}

const customerSelect = [
  'id',
  'name',
  'email',
  'assignedPlan',
  'storageQuotaOverride',
  'maxFileSizeOverride',
  'monthlyBandwidthLimitOverride',
  'storageQuota',
  'storageUsed',
  'maxFileSizeBytes',
  'monthlyBandwidthLimitBytes',
  'monthlyBandwidthUsedBytes',
  'bandwidthPeriodStart',
  'lockedAt',
  'lockReason',
] as const;

export async function listAdminCustomers(): Promise<AdminCustomerSummary[]> {
  const users = await orm.User.select(...customerSelect)
    .orderBy((user) => user.createdAt.desc())
    .all();

  const summaries: AdminCustomerSummary[] = [];

  for (const user of users) {
    const usage = await getCustomerStorageUsageByCategory(user.id);
    const fileCount =
      usage?.categories.reduce((total, category) => total + category.fileCount, 0) ??
      0;
    summaries.push(await toSummary(user, fileCount));
  }

  return summaries;
}

export async function getAdminCustomerDetail(
  userId: string,
): Promise<AdminCustomerDetail | null> {
  const user = await loadCustomerRecord(userId);
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

  return toDetail(
    user,
    fileCount,
    usage.categories.map((category) => ({
      category: category.category,
      label: category.label,
      bytesUsed: category.bytesUsed.toString(),
      bytesLabel: category.bytesLabel,
      fileCount: category.fileCount,
    })),
  );
}

export async function listAdminPlanOptions() {
  const plans = await listPlanConfigurations();
  return plans.map((plan) => ({
    plan: plan.plan,
    displayName: plan.displayName,
    storageQuotaBytes: plan.storageQuotaBytes.toString(),
    maxFileSizeBytes: plan.maxFileSizeBytes.toString(),
    monthlyBandwidthLimitBytes: plan.monthlyBandwidthLimitBytes.toString(),
  }));
}

export type AdminCustomerLimitUpdate = {
  userId: string;
  assignedPlan?: Plan;
  storageQuotaOverrideBytes?: bigint | null;
  maxFileSizeOverrideBytes?: bigint | null;
  monthlyBandwidthLimitOverrideBytes?: bigint | null;
};

export async function updateAdminCustomerAllocation(
  params: AdminCustomerLimitUpdate,
): Promise<AdminCustomerDetail | null> {
  const user = await orm.User.where({ id: params.userId })
    .select(
      'id',
      'assignedPlan',
      'storageQuotaOverride',
      'maxFileSizeOverride',
      'monthlyBandwidthLimitOverride',
      'storageUsed',
    )
    .first();

  if (!user) {
    return null;
  }

  const updates: Record<string, Plan | bigint | null> = {};

  if (params.assignedPlan !== undefined) {
    updates.assignedPlan = params.assignedPlan;
  }
  if (params.storageQuotaOverrideBytes !== undefined) {
    updates.storageQuotaOverride = params.storageQuotaOverrideBytes;
  }
  if (params.maxFileSizeOverrideBytes !== undefined) {
    updates.maxFileSizeOverride = params.maxFileSizeOverrideBytes;
  }
  if (params.monthlyBandwidthLimitOverrideBytes !== undefined) {
    updates.monthlyBandwidthLimitOverride =
      params.monthlyBandwidthLimitOverrideBytes;
  }

  if (Object.keys(updates).length > 0) {
    await orm.User.where({ id: params.userId }).update(updates);
  }

  const nextPlan = params.assignedPlan ?? user.assignedPlan;
  if (params.assignedPlan !== undefined) {
    await syncUserSubscriptionPlan(params.userId, nextPlan);
  }

  const layers = await recomputeAndPersistUserEffectiveLimits(params.userId);
  if (!layers) {
    return null;
  }

  if (layers.storage.effectiveBytes < BigInt(user.storageUsed)) {
    return null;
  }

  return getAdminCustomerDetail(params.userId);
}

/** @deprecated Use updateAdminCustomerAllocation */
export async function updateAdminCustomerLimits(params: {
  userId: string;
  storageQuotaBytes?: bigint;
  maxFileSizeBytes?: bigint;
  monthlyBandwidthLimitBytes?: bigint;
}): Promise<AdminCustomerDetail | null> {
  return updateAdminCustomerAllocation({
    userId: params.userId,
    storageQuotaOverrideBytes: params.storageQuotaBytes,
    maxFileSizeOverrideBytes: params.maxFileSizeBytes,
    monthlyBandwidthLimitOverrideBytes: params.monthlyBandwidthLimitBytes,
  });
}

export async function getAdminCustomerLimitSnapshot(userId: string) {
  const user = await loadCustomerRecord(userId);
  if (!user) {
    return null;
  }

  const planConfig = await getPlanConfiguration(user.assignedPlan);
  const layers = resolveLimitLayers(
    {
      assignedPlan: user.assignedPlan,
      storageQuotaOverride: user.storageQuotaOverride,
      maxFileSizeOverride: user.maxFileSizeOverride,
      monthlyBandwidthLimitOverride: user.monthlyBandwidthLimitOverride,
    },
    planConfig,
  );

  return {
    assignedPlan: user.assignedPlan,
    storageQuota: user.storageQuota.toString(),
    maxFileSizeBytes: user.maxFileSizeBytes.toString(),
    monthlyBandwidthLimitBytes: user.monthlyBandwidthLimitBytes.toString(),
    layers,
  };
}
