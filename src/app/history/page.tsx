import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/history');

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Search History</h1>
        <div className="mt-8 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-zinc-500">No search history yet. Start searching to build your history.</p>
        </div>
      </main>
    </>
  );
}
