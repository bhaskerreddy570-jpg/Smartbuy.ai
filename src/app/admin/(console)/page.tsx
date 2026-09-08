import { getAdminOverviewStats } from "@/lib/admin/overview";
import Link from "next/link";

export default async function AdminOverviewPage() {
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Admin overview</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Platform-wide customer, storage, and bandwidth metrics.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="admin-stat-card">
          <p className="admin-stat-label">Total customers</p>
          <p className="admin-stat-value">{stats.totalCustomers}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Active customers</p>
          <p className="admin-stat-value">{stats.activeCustomers}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Locked customers</p>
          <p className="admin-stat-value">{stats.lockedCustomers}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Bandwidth used</p>
          <p className="admin-stat-value">{stats.totalBandwidthUsedLabel}</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="admin-card">
          <h2 className="text-lg font-semibold">Storage allocation</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Total allocated</dt>
              <dd className="font-medium">{stats.totalAllocatedStorageLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Total used</dt>
              <dd className="font-medium">{stats.totalStorageUsedLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Total remaining</dt>
              <dd className="font-medium">{stats.totalStorageRemainingLabel}</dd>
            </div>
          </dl>
        </article>

        <article className="admin-card">
          <h2 className="text-lg font-semibold">Bandwidth</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Monthly used</dt>
              <dd className="font-medium">{stats.totalBandwidthUsedLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500 dark:text-zinc-400">Monthly limit total</dt>
              <dd className="font-medium">{stats.totalBandwidthLimitLabel}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="admin-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent administrative activity</h2>
          <Link href="/admin/audit-logs" className="text-sm font-medium text-amber-700 dark:text-amber-300">
            View all
          </Link>
        </div>
        {stats.recentActivity.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No audit events yet.</p>
        ) : (
          <div className="overflow-x-auto">
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
                    <td>
                      {log.targetType ?? "—"}
                      {log.targetId ? ` / ${log.targetId}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card">
        <h2 className="text-lg font-semibold">Quick links</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/admin/customers" className="admin-primary-button">
            Manage customers
          </Link>
          <Link href="/admin/recovery" className="admin-secondary-button">
            Recovery tools
          </Link>
        </div>
      </section>
    </div>
  );
}
