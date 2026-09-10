import { orm } from '@/lib/db';

export default async function AdminAlertsPage() {
  let alerts: Array<{
    id: string;
    userId: string;
    productId: string;
    targetPrice: unknown;
    status: string;
    createdAt: string;
  }> = [];

  try {
    alerts = await orm.PriceAlert.orderBy((a) => a.createdAt.desc()).all();
    alerts = alerts.slice(0, 50);
  } catch {
    /* database may be unavailable */
  }

  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const triggeredCount = alerts.filter((a) => a.status === 'TRIGGERED').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Price alerts</h1>
        <p className="mt-1 text-sm text-zinc-500">Customer price alert subscriptions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Active</p>
          <p className="mt-2 text-2xl font-semibold">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Triggered</p>
          <p className="mt-2 text-2xl font-semibold">{triggeredCount}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Target</th>
              <th className="px-4 py-2 text-left">Product</th>
              <th className="px-4 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-zinc-500">No alerts.</td>
              </tr>
            ) : (
              alerts.map((a) => (
                <tr key={a.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{a.status}</td>
                  <td className="px-4 py-2">₹{Number(a.targetPrice).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2 font-mono text-xs">{a.productId.slice(0, 8)}…</td>
                  <td className="px-4 py-2">{new Date(a.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
