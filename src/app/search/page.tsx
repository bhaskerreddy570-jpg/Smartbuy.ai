import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import { SearchBox } from '@/components/smartbuy/search-box';
import { SearchPageClient } from '@/components/smartbuy/search-page-client';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? '';

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <SearchBox />
        </div>
        {query ? <SearchPageClient query={query} /> : (
          <p className="text-center text-zinc-500">Enter a search query to get started.</p>
        )}
      </main>
    </>
  );
}
