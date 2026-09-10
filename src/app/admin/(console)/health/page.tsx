import { orm } from '@/lib/db';
import { getSiteName, isMockProvidersEnabled } from '@/lib/site-config';

export default async function AdminHealthPage() {
  let dbOk = false;
  let providerCount = 0;
  let recentEvents: Array<{ eventType: string; severity: string; message: string; createdAt: string }> = [];

  try {
    await orm.SystemSetting.where({ key: 'site_name' }).first();
    dbOk = true;
    providerCount = (await orm.Provider.all()).length;
    recentEvents = await orm.SystemEvent.orderBy((e) => e.createdAt.desc()).all();
    recentEvents = recentEvents.slice(0, 10);
  } catch {
    dbOk = false;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System health</h1>
        <p className="mt-1 text-sm text-zinc-500">Runtime status for {getSiteName()}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HealthCard label="Database" value={dbOk ? 'Connected' : 'Unavailable'} ok={dbOk} />
        <HealthCard label="Providers registered" value={String(providerCount)} ok={providerCount > 0} />
        <HealthCard label="Mock providers" value={isMockProvidersEnabled() ? 'Enabled' : 'Disabled'} ok={true} />
      </div>

      <section>
        <h2 className="text-lg font-medium">Recent system events</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Message</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-zinc-500">No events recorded.</td>
                </tr>
              ) : (
                recentEvents.map((e, i) => (
                  <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">{new Date(e.createdAt).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2">{e.eventType}</td>
                    <td className="px-4 py-2">{e.severity}</td>
                    <td className="px-4 py-2">{e.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HealthCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${ok ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</p>
    </div>
  );
}
