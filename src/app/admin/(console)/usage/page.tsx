import { getAdminOverviewStats } from "@/lib/admin/overview";

export default async function AdminUsagePage() {
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Usage</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Aggregate bandwidth and customer activity metrics.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2">
        <article className="admin-stat-card">
          <p className="admin-stat-label">Monthly bandwidth used</p>
          <p className="admin-stat-value">{stats.totalBandwidthUsedLabel}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Monthly bandwidth limit total</p>
          <p className="admin-stat-value">{stats.totalBandwidthLimitLabel}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Active customers</p>
          <p className="admin-stat-value">{stats.activeCustomers}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Locked customers</p>
          <p className="admin-stat-value">{stats.lockedCustomers}</p>
        </article>
      </section>
    </div>
  );
}
