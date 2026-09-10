import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/alerts');

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Price Alerts</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Set alerts from any product page. We&apos;ll notify you when the price drops below your target.
        </p>
        <div className="mt-8 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-zinc-500">No active alerts yet.</p>
        </div>
      </main>
    </>
  );
}
