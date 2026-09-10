import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import { getUserSearchHistory } from '@/lib/smartbuy/repositories/search-repository';

export default async function HistoryPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/history');

  const history = await getUserSearchHistory(session.user.id);

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Search History</h1>

        {history.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
            <p className="text-zinc-500">No search history yet.</p>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
              Start searching
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {history.map((search) => (
              <li key={search.id}>
                <Link
                  href={`/search?q=${encodeURIComponent(search.query)}`}
                  className="block rounded-xl border border-zinc-200 p-4 transition hover:border-emerald-300 dark:border-zinc-800 dark:hover:border-emerald-700"
                >
                  <p className="font-medium">{search.query}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {new Date(search.createdAt).toLocaleString('en-IN')}
                    {search.resultCount > 0 ? ` · ${search.resultCount} results` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
