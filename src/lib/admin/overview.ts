import { orm } from '@/lib/db';
import { getAffiliateAnalyticsSummary } from '@/lib/smartbuy/repositories/affiliate-repository';

async function getSearchCount(): Promise<number> {
  try {
    const searches = await orm.Search.select('id').all();
    return searches.length;
  } catch {
    return 0;
  }
}

export async function getAdminOverviewStats() {
  const [totalUsers, recentActivity, affiliateStats, searchCount] = await Promise.all([
    orm.User.select('id').all().then((users) => users.length),
    orm.AdminAuditLog
      .orderBy((log) => log.createdAt.desc())
      .select('id', 'action', 'targetType', 'targetId', 'createdAt')
      .all()
      .then((logs) => logs.slice(0, 10)),
    getAffiliateAnalyticsSummary(),
    getSearchCount(),
  ]);

  return {
    totalUsers,
    searchesToday: searchCount,
    affiliateClicks: affiliateStats.totalClicks,
    estimatedCommission: affiliateStats.estimatedRevenue,
    confirmedCommission: affiliateStats.confirmedRevenue,
    paidCommission: affiliateStats.paidRevenue,
    conversionRate: affiliateStats.conversionRate,
    recentActivity,
  };
}
