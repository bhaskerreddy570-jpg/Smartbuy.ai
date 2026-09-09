import { cookies } from 'next/headers';
import { cache } from 'react';
import { orm } from '@/lib/db';
import {
  resolveCustomerLimits,
  shouldResetBandwidthPeriod,
} from '@/lib/customer-limits';
import { getDashboardSummary, mapStoredFileToDashboardEntry } from '@/lib/dashboard';
import { ADMIN_SESSION_COOKIE, getAdminSessionUser } from '@/lib/admin/session';
import { resolvePortalUserRole } from '@/lib/admin/bootstrap';
import { isCustomerAccountLocked } from '@/lib/admin/customer-accounts';
import { getCustomerStorageUsageByCategory } from '@/lib/storage/category-usage';
import { formatBytes } from '@/lib/storage/validation';
import type { FileCategory } from '@/lib/storage/types';
import { getOverviewSmartAccess } from '@/lib/portal/security-data';
import type { SmartFileSummary } from '@/lib/storage/file-insights';
import { ensureCustomerQuotaPersisted } from '@/lib/quota-backfill';

export type PortalUser = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  status: 'Active' | 'Locked';
  role: 'USER' | 'ADMIN';
};

export type PortalStorageSummary = {
  used: string;
  quota: string;
  remaining: string;
  usedLabel: string;
  quotaLabel: string;
  remainingLabel: string;
  percentUsed: number;
};

export type PortalContext = {
  user: PortalUser;
  storageSummary: PortalStorageSummary;
  hasAdminSession: boolean;
};

export type CategoryCardData = {
  id: FileCategory;
  label: string;
  bytesUsed: string;
  bytesLabel: string;
  fileCount: number;
  percentOfQuota: number;
};

export type OverviewData = Omit<
  NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>>,
  'categories' | 'files' | 'activeCategory' | 'view'
> & {
  user: PortalUser;
  greeting: string;
  categoryUsage: CategoryCardData[];
  recentFiles: ReturnType<typeof mapStoredFileToDashboardEntry>[];
  smartAccess: {
    recentlyOpened: SmartFileSummary[];
    secureFiles: SmartFileSummary[];
    largeFiles: SmartFileSummary[];
  };
};

function buildGreeting(name: string | null): string {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${salutation}, ${name.split(' ')[0]}` : salutation;
}

async function getPortalContextImpl(userId: string): Promise<PortalContext | null> {
  await ensureCustomerQuotaPersisted(userId);

  const user = await orm.User.where({ id: userId })
    .select('id', 'name', 'email', 'createdAt', 'lockedAt', 'storageQuota', 'storageUsed')
    .first();

  if (!user || isCustomerAccountLocked(user)) {
    return null;
  }

  const limits = resolveCustomerLimits({
    ...user,
    maxFileSizeBytes: 0,
    monthlyBandwidthLimitBytes: 0,
    monthlyBandwidthUsedBytes: 0,
    bandwidthPeriodStart: null,
  });

  const percentUsed =
    limits.storageQuota > 0n
      ? Math.min(Number((limits.storageUsed * 100n) / limits.storageQuota), 100)
      : 0;

  const cookieStore = await cookies();
  const adminSession = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );
  const portalRole = await resolvePortalUserRole(user.email);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      status: 'Active',
      role: portalRole,
    },
    storageSummary: {
      used: limits.storageUsed.toString(),
      quota: limits.storageQuota.toString(),
      remaining: limits.storageRemaining.toString(),
      usedLabel: formatBytes(limits.storageUsed),
      quotaLabel: formatBytes(limits.storageQuota),
      remainingLabel: formatBytes(limits.storageRemaining),
      percentUsed,
    },
    hasAdminSession: adminSession?.role === 'ADMIN',
  };
}

export const getPortalContext = cache(getPortalContextImpl);

export const getOverviewData = cache(async (userId: string): Promise<OverviewData | null> => {
  await ensureCustomerQuotaPersisted(userId);

  const [summary, usage, user, smartAccess] = await Promise.all([
    getDashboardSummary(userId),
    getCustomerStorageUsageByCategory(userId),
    orm.User.where({ id: userId })
      .select('id', 'name', 'email', 'createdAt', 'lockedAt')
      .first(),
    getOverviewSmartAccess(userId),
  ]);

  if (!summary || !user || isCustomerAccountLocked(user)) {
    return null;
  }

  const portalRole = await resolvePortalUserRole(user.email);

  const quota = BigInt(summary.storage.quota);
  const categorySource = usage?.categories ?? [];
  const categories: CategoryCardData[] = (categorySource.length > 0
    ? categorySource
    : summary.categories.map((c) => ({
        category: c.id,
        label: c.label,
        bytesUsed: BigInt(0),
        bytesLabel: formatBytes(0n),
        fileCount: c.count,
      }))
  ).map((category) => ({
    id: category.category,
    label: category.label,
    bytesUsed: category.bytesUsed.toString(),
    bytesLabel: category.bytesLabel,
    fileCount: category.fileCount,
    percentOfQuota:
      quota > 0n
        ? Math.min(Number((category.bytesUsed * 100n) / quota), 100)
        : 0,
  }));

  const recentFiles = smartAccess.recentUploads.map((file) =>
    mapStoredFileToDashboardEntry({
      id: file.id,
      name: file.name,
      originalName: file.name,
      size: file.size,
      mimeType: file.mimeType,
      category: file.category,
      starred: file.starred,
      securityMode: file.securityMode,
      createdAt: file.createdAt,
    }),
  );

  return {
    storage: summary.storage,
    bandwidth: summary.bandwidth,
    maxFileSize: summary.maxFileSize,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      status: 'Active',
      role: portalRole,
    },
    greeting: buildGreeting(user.name),
    categoryUsage: categories,
    recentFiles,
    smartAccess: {
      recentlyOpened: smartAccess.recentlyOpened,
      secureFiles: smartAccess.secureFiles,
      largeFiles: smartAccess.largeFiles,
    },
  };
});

export type ProfileData = {
  user: PortalUser;
  storage: PortalStorageSummary;
  bandwidth: {
    usedLabel: string;
    limitLabel: string;
    remainingLabel: string;
    percentUsed: number;
  };
  maxFileSizeLabel: string;
  plan: string;
};

export async function getProfileData(userId: string): Promise<ProfileData | null> {
  await ensureCustomerQuotaPersisted(userId);

  const user = await orm.User.where({ id: userId })
    .select(
      'id',
      'name',
      'email',
      'createdAt',
      'lockedAt',
      'storageQuota',
      'storageUsed',
      'maxFileSizeBytes',
      'monthlyBandwidthLimitBytes',
      'monthlyBandwidthUsedBytes',
      'bandwidthPeriodStart',
    )
    .first();

  if (!user || isCustomerAccountLocked(user)) {
    return null;
  }

  const portalRole = await resolvePortalUserRole(user.email);
  const limits = resolveCustomerLimits(user);
  const bandwidthUsed = shouldResetBandwidthPeriod(user.bandwidthPeriodStart)
    ? 0n
    : limits.monthlyBandwidthUsedBytes;
  const bandwidthRemaining =
    limits.monthlyBandwidthLimitBytes >= bandwidthUsed
      ? limits.monthlyBandwidthLimitBytes - bandwidthUsed
      : 0n;
  const bandwidthPercent =
    limits.monthlyBandwidthLimitBytes > 0n
      ? Math.min(
          Number((bandwidthUsed * 100n) / limits.monthlyBandwidthLimitBytes),
          100,
        )
      : 0;

  const subscription = await orm.Subscription.where({ userId })
    .select('plan')
    .first();

  const percentUsed =
    limits.storageQuota > 0n
      ? Math.min(Number((limits.storageUsed * 100n) / limits.storageQuota), 100)
      : 0;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      status: 'Active',
      role: portalRole,
    },
    storage: {
      used: limits.storageUsed.toString(),
      quota: limits.storageQuota.toString(),
      remaining: limits.storageRemaining.toString(),
      usedLabel: formatBytes(limits.storageUsed),
      quotaLabel: formatBytes(limits.storageQuota),
      remainingLabel: formatBytes(limits.storageRemaining),
      percentUsed,
    },
    bandwidth: {
      usedLabel: formatBytes(bandwidthUsed),
      limitLabel: formatBytes(limits.monthlyBandwidthLimitBytes),
      remainingLabel: formatBytes(bandwidthRemaining),
      percentUsed: bandwidthPercent,
    },
    maxFileSizeLabel: formatBytes(limits.maxFileSizeBytes),
    plan: subscription?.plan ?? 'FREE',
  };
}
