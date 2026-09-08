import { getAdminOverviewStats } from "@/lib/admin/overview";

export default async function AdminStoragePage() {
  const stats = await getAdminOverviewStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Storage</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Platform-wide storage allocation and consumption.
        </p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <article className="admin-stat-card">
          <p className="admin-stat-label">Allocated</p>
          <p className="admin-stat-value">{stats.totalAllocatedStorageLabel}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Used</p>
          <p className="admin-stat-value">{stats.totalStorageUsedLabel}</p>
        </article>
        <article className="admin-stat-card">
          <p className="admin-stat-label">Remaining</p>
          <p className="admin-stat-value">{stats.totalStorageRemainingLabel}</p>
        </article>
      </section>
    </div>
  );
}
