import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import { orm } from '@/lib/db';

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/alerts');

  let alerts: Array<{
    id: string;
    productId: string;
    targetPrice: unknown;
    status: string;
    createdAt: string;
    triggeredAt: string | null;
  }> = [];
  const productTitles: Record<string, string> = {};

  try {
    alerts = await orm.PriceAlert.where({ userId: session.user.id })
      .orderBy((a) => a.createdAt.desc())
      .all();

    for (const alert of alerts) {
      const product = await orm.Product.where({ id: alert.productId }).select('title').first();
      if (product) productTitles[alert.productId] = product.title;
    }
  } catch {
    /* database may be unavailable */
  }

  const active = alerts.filter((a) => a.status === 'ACTIVE');
  const triggered = alerts.filter((a) => a.status === 'TRIGGERED');

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Price Alerts</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          We notify you when a product drops below your target price.
        </p>

        {alerts.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
            <p className="text-zinc-500">No alerts yet.</p>
            <Link href="/search" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
              Search products to set an alert
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {active.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Active</h2>
                <ul className="mt-3 space-y-3">
                  {active.map((alert) => (
                    <li
                      key={alert.id}
                      className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <p className="font-medium">{productTitles[alert.productId] ?? 'Product'}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Target: ₹{Number(alert.targetPrice).toLocaleString('en-IN')}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {triggered.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Triggered</h2>
                <ul className="mt-3 space-y-3">
                  {triggered.map((alert) => (
                    <li
                      key={alert.id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-800 dark:bg-emerald-950/20"
                    >
                      <p className="font-medium">{productTitles[alert.productId] ?? 'Product'}</p>
                      <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                        Triggered {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString('en-IN') : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </main>
    </>
  );
}
