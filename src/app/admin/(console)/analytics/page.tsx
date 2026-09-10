import { getAdminOverviewStats } from '@/lib/admin/overview';
import { orm } from '@/lib/db';

type ProviderRow = Awaited<ReturnType<typeof orm.Provider.all>>[number];

export default async function AdminAnalyticsPage() {
  const stats = await getAdminOverviewStats();

  let providers: ProviderRow[] = [];
  let merchantCount = 0;
  try {
    providers = await orm.Provider.all();
    const merchants = await orm.Merchant.all();
    merchantCount = merchants.length;
  } catch {
    /* database may be unavailable */
  }

  const revenuePerSearch =
    stats.searchesToday > 0 ? stats.estimatedCommission / stats.searchesToday : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">Search, affiliate, and merchant performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Total searches" value={stats.searchesToday} />
        <Metric label="Affiliate clicks" value={stats.affiliateClicks} />
        <Metric label="Conversion rate" value={`${(stats.conversionRate * 100).toFixed(1)}%`} />
        <Metric label="Revenue per search" value={`₹${revenuePerSearch.toFixed(2)}`} />
        <Metric label="Active providers" value={providers.filter((p) => p.status === 'ACTIVE').length} />
        <Metric label="Merchants" value={merchantCount} />
      </div>

      <section>
        <h2 className="text-lg font-medium">Provider status</h2>
        <ul className="mt-3 space-y-2">
          {providers.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800">
              <span>{p.name}</span>
              <span className="text-sm text-zinc-500">{p.status} · {p.dataMode}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}
