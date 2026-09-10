import { orm } from '@/lib/db';

export async function getAdminOverviewStats() {
  const [totalUsers, recentActivity] = await Promise.all([
    orm.User.select('id').all().then((users) => users.length),
    orm.AdminAuditLog
      .orderBy((log) => log.createdAt.desc())
      .select('id', 'action', 'targetType', 'targetId', 'createdAt')
      .all()
      .then((logs) => logs.slice(0, 10)),
  ]);

  return {
    totalUsers,
    searchesToday: 0,
    affiliateClicks: 0,
    estimatedCommission: 0,
    confirmedCommission: 0,
    paidCommission: 0,
    recentActivity,
  };
}
