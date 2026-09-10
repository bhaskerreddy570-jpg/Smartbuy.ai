import { orm } from '@/lib/db';

export default async function AdminMatchingPage() {
  let listings: Array<{
    id: string;
    title: string;
    matchConfidence: unknown;
    canonicalProductId: string | null;
    merchantId: string;
  }> = [];

  try {
    listings = await orm.MerchantListing.orderBy((l) => l.updatedAt.desc()).all();
    listings = listings.slice(0, 50);
  } catch {
    /* database may be unavailable */
  }

  const matched = listings.filter((l) => l.canonicalProductId);
  const unmatched = listings.filter((l) => !l.canonicalProductId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Product matching</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Review merchant listing matches. Manual merge/unmerge requires provider sync (planned).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Matched listings</p>
          <p className="mt-2 text-2xl font-semibold">{matched.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Unmatched listings</p>
          <p className="mt-2 text-2xl font-semibold">{unmatched.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Confidence</th>
              <th className="px-4 py-2 text-left">Canonical product</th>
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-zinc-500">
                  No merchant listings. Sync from providers or run seed.
                </td>
              </tr>
            ) : (
              listings.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{l.title}</td>
                  <td className="px-4 py-2">
                    {l.matchConfidence != null
                      ? `${(Number(l.matchConfidence) * 100).toFixed(0)}%`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {l.canonicalProductId ? `${l.canonicalProductId.slice(0, 8)}…` : 'Unmatched'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
