import { randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';
import { appConfig } from '@/lib/config';

export type Plan = 'FREE' | 'BASIC' | 'PRO' | 'BUSINESS';

export type PlanLimitConfiguration = {
  plan: Plan;
  displayName: string;
  storageQuotaBytes: bigint;
  maxFileSizeBytes: bigint;
  monthlyBandwidthLimitBytes: bigint;
  active: boolean;
};

const GIB = 1024n * 1024n * 1024n;

export const DEFAULT_PLAN_LIMITS: Record<Plan, Omit<PlanLimitConfiguration, 'active'>> = {
  FREE: {
    plan: 'FREE',
    displayName: 'Free',
    storageQuotaBytes: appConfig.defaultStorageQuotaBytes,
    maxFileSizeBytes: appConfig.defaultMaxFileSizeBytes,
    monthlyBandwidthLimitBytes: appConfig.defaultMonthlyBandwidthLimitBytes,
  },
  BASIC: {
    plan: 'BASIC',
    displayName: 'Basic',
    storageQuotaBytes: 100n * GIB,
    maxFileSizeBytes: 10n * GIB,
    monthlyBandwidthLimitBytes: 500n * GIB,
  },
  PRO: {
    plan: 'PRO',
    displayName: 'Pro',
    storageQuotaBytes: 500n * GIB,
    maxFileSizeBytes: 25n * GIB,
    monthlyBandwidthLimitBytes: 2n * 1024n * GIB,
  },
  BUSINESS: {
    plan: 'BUSINESS',
    displayName: 'Business',
    storageQuotaBytes: 2n * 1024n * GIB,
    maxFileSizeBytes: 100n * GIB,
    monthlyBandwidthLimitBytes: 10n * 1024n * GIB,
  },
};

const PLAN_ORDER: Plan[] = ['FREE', 'BASIC', 'PRO', 'BUSINESS'];

let cachedPlans: Map<Plan, PlanLimitConfiguration> | null = null;

function mapPlanRow(row: {
  plan: Plan;
  displayName: string;
  storageQuotaBytes: bigint | number | string;
  maxFileSizeBytes: bigint | number | string;
  monthlyBandwidthLimitBytes: bigint | number | string;
  active: boolean;
}): PlanLimitConfiguration {
  return {
    plan: row.plan,
    displayName: row.displayName,
    storageQuotaBytes: BigInt(row.storageQuotaBytes),
    maxFileSizeBytes: BigInt(row.maxFileSizeBytes),
    monthlyBandwidthLimitBytes: BigInt(row.monthlyBandwidthLimitBytes),
    active: row.active,
  };
}

export async function ensurePlanConfigurationsSeeded(): Promise<void> {
  for (const plan of PLAN_ORDER) {
    const defaults = DEFAULT_PLAN_LIMITS[plan];
    const existing = await orm.PlanConfiguration.where({ plan }).first();

    if (!existing) {
      await orm.PlanConfiguration.create({
        plan,
        displayName: defaults.displayName,
        storageQuotaBytes: defaults.storageQuotaBytes,
        maxFileSizeBytes: defaults.maxFileSizeBytes,
        monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
        active: true,
      });
      continue;
    }

    await orm.PlanConfiguration.where({ plan }).update({
      displayName: defaults.displayName,
      active: true,
      storageQuotaBytes: defaults.storageQuotaBytes,
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
    });
  }

  cachedPlans = null;
}

export async function listPlanConfigurations(): Promise<PlanLimitConfiguration[]> {
  await ensurePlanConfigurationsSeeded();

  const rows = await orm.PlanConfiguration.where({ active: true })
    .select(
      'plan',
      'displayName',
      'storageQuotaBytes',
      'maxFileSizeBytes',
      'monthlyBandwidthLimitBytes',
      'active',
    )
    .all();

  return PLAN_ORDER.map((plan) => {
    const row = rows.find((entry) => entry.plan === plan);
    if (!row) {
      return { ...DEFAULT_PLAN_LIMITS[plan], active: true };
    }
    return mapPlanRow(row);
  });
}

export async function getPlanConfiguration(plan: Plan): Promise<PlanLimitConfiguration> {
  if (cachedPlans?.has(plan)) {
    return cachedPlans.get(plan)!;
  }

  await ensurePlanConfigurationsSeeded();

  const row = await orm.PlanConfiguration.where({ plan })
    .select(
      'plan',
      'displayName',
      'storageQuotaBytes',
      'maxFileSizeBytes',
      'monthlyBandwidthLimitBytes',
      'active',
    )
    .first();

  const resolved = row
    ? mapPlanRow(row)
    : { ...DEFAULT_PLAN_LIMITS[plan], active: true };

  if (!cachedPlans) {
    cachedPlans = new Map();
  }
  cachedPlans.set(plan, resolved);

  return resolved;
}

export function clearPlanConfigurationCache(): void {
  cachedPlans = null;
}

export async function getActiveSubscriptionPlan(userId: string): Promise<Plan | null> {
  const subscription = await orm.Subscription.where({
    userId,
    status: 'ACTIVE',
  })
    .select('plan')
    .first();

  return subscription?.plan ?? null;
}

export async function syncUserSubscriptionPlan(userId: string, plan: Plan): Promise<void> {
  const subscription = await orm.Subscription.where({ userId, status: 'ACTIVE' })
    .select('id')
    .first();

  if (subscription) {
    await orm.Subscription.where({ id: subscription.id }).update({
      plan,
      storageQuota: (await getPlanConfiguration(plan)).storageQuotaBytes,
    });
    return;
  }

  await orm.Subscription.create({
    id: randomUUID(),
    userId,
    plan,
    status: 'ACTIVE',
    storageQuota: (await getPlanConfiguration(plan)).storageQuotaBytes,
  });
}
