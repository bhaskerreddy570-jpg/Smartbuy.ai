import { getAdminOverviewStats } from '@/lib/admin/overview';
import Link from 'next/link';

export default async function AdminOverviewPage() {
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">SmartBuy AI Admin</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Platform overview — users, searches, affiliate performance.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="admin-stat-card">
          <p className="admin-stat-label">Total users</p>
          <p className="admin-stat-value">{stats.totalUsers}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Searches today</p>
          <p className="admin-stat-value">{stats.searchesToday}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Affiliate clicks</p>
          <p className="admin-stat-value">{stats.affiliateClicks}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Est. commission</p>
          <p className="admin-stat-value">₹{stats.estimatedCommission}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="admin-card">
          <h2 className="text-lg font-semibold">Commission states</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Estimated</dt>
              <dd className="font-medium">₹{stats.estimatedCommission}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Confirmed</dt>
              <dd className="font-medium">₹{stats.confirmedCommission}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Paid</dt>
              <dd className="font-medium">₹{stats.paidCommission}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="admin-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent admin activity</h2>
          <Link href="/admin/audit-logs" className="text-sm font-medium text-emerald-700">
            View all
          </Link>
        </div>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-zinc-500">No audit events yet.</p>
        ) : (
          <table className="admin-table min-w-full">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentActivity.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.action}</td>
                  <td>{log.targetType ?? '—'}{log.targetId ? ` / ${log.targetId}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-card">
        <h2 className="text-lg font-semibold">Quick links</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/providers" className="admin-primary-button">Providers</Link>
          <Link href="/admin/merchants" className="admin-secondary-button">Merchants</Link>
          <Link href="/admin/settings" className="admin-secondary-button">Settings</Link>
        </div>
      </section>
    </div>
  );
}
