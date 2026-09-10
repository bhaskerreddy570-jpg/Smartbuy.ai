'use client';

import type { RecommendationResult, ScoredListing } from '@/lib/smartbuy/types';

interface SearchResultsProps {
  query: string;
  recommendations: RecommendationResult;
  providerStatuses: Array<{ provider: string; status: string; count: number; message?: string }>;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

function ListingCard({ item, highlight }: { item: ScoredListing; highlight?: boolean }) {
  const buyUrl = `/go/product?merchant=${item.merchantSlug}&productId=${item.listing.merchantProductId}`;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        highlight
          ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/20'
          : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
      }`}
    >
      {item.badge && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
          {item.badge === 'BEST_OVERALL' ? '🏆 BEST OVERALL' : '💰 CHEAPEST'}
        </div>
      )}

      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {item.listing.title}
      </h3>

      <div className="mt-2 flex items-baseline gap-2">
        {item.listing.price && (
          <span className="text-2xl font-bold text-emerald-600">
            {formatPrice(item.listing.price)}
          </span>
        )}
        {item.listing.mrp && item.listing.price && item.listing.mrp > item.listing.price && (
          <span className="text-sm text-zinc-400 line-through">
            {formatPrice(item.listing.mrp)}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-500">
        <span>{item.merchantName}</span>
        {item.listing.rating && <span>★ {item.listing.rating}</span>}
        {item.listing.availability && <span>{item.listing.availability}</span>}
        <span className="text-zinc-400">{item.dataFreshnessLabel}</span>
      </div>

      {item.explanation.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Why we recommend it:</p>
          <ul className="mt-1 space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {item.explanation.map((reason) => (
              <li key={reason}>• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {item.savingsVsHighest && item.savingsVsHighest > 0 && (
        <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          You save {formatPrice(item.savingsVsHighest)} ({item.savingsPercent}%)
        </p>
      )}

      <a
        href={buyUrl}
        className="mt-4 inline-block rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Buy on {item.merchantName}
      </a>
    </div>
  );
}

export function SearchResults({ query, recommendations, providerStatuses }: SearchResultsProps) {
  const { bestOverall, cheapest, allListings, matchedGroups } = recommendations;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Results for &ldquo;{query}&rdquo;
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {providerStatuses.map((ps) => (
            <span
              key={ps.provider}
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                ps.status === 'OK'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              {ps.provider}: {ps.status === 'OK' ? `${ps.count} results` : ps.message ?? ps.status}
            </span>
          ))}
        </div>
      </div>

      {bestOverall && <ListingCard item={bestOverall} highlight />}

      {cheapest && cheapest.listing.merchantProductId !== bestOverall?.listing.merchantProductId && (
        <ListingCard item={cheapest} />
      )}

      {matchedGroups.length > 1 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Price comparison across stores
          </h2>
          <div className="space-y-6">
            {matchedGroups.map((group) => (
              <div key={group.canonicalKey} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                {group.matchConfidence < 1 && (
                  <p className="mb-3 text-xs text-zinc-500">
                    Match confidence: {(group.matchConfidence * 100).toFixed(0)}%
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.listings.map((item) => (
                    <div key={item.listing.merchantProductId} className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-700">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">{item.merchantName}</p>
                      {item.listing.price && (
                        <p className="text-lg font-bold text-emerald-600">{formatPrice(item.listing.price)}</p>
                      )}
                      <a
                        href={`/go/product?merchant=${item.merchantSlug}&productId=${item.listing.merchantProductId}`}
                        className="mt-2 inline-block text-sm text-emerald-600 hover:underline"
                      >
                        Buy on {item.merchantName}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {allListings.length > 0 && matchedGroups.length <= 1 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">All results</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {allListings.map((item) => (
              <ListingCard key={`${item.merchantSlug}-${item.listing.merchantProductId}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {allListings.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            Unable to retrieve live results right now. Try a different search or check back later.
          </p>
        </div>
      )}
    </div>
  );
}
