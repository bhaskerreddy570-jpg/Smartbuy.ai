'use client';

import { useEffect, useState } from 'react';
import { SearchResults } from './search-results';
import { RideComparison } from './ride-comparison';
import type { RecommendationResult } from '@/lib/smartbuy/types';
import type { ParsedIntent } from '@/lib/smartbuy/types';

interface SearchData {
  type: 'product' | 'ride';
  query: string;
  intent: ParsedIntent;
  recommendations?: RecommendationResult;
  providerStatuses?: Array<{ provider: string; status: string; count: number; message?: string }>;
  providers?: Array<{
    providerSlug: string;
    providerName: string;
    liveAvailable: boolean;
    deepLink?: string;
    dataSource: string;
  }>;
  message?: string;
}

export function SearchPageClient({ query }: { query: string }) {
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runSearch() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? 'Search failed');
        }
        const result = await res.json();
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    }
    runSearch();
  }, [query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="mt-4 text-zinc-500">Searching across providers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950/20">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  if (data.type === 'ride' && data.providers) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Ride options for &ldquo;{query}&rdquo;</h1>
        <RideComparison providers={data.providers} message={data.message ?? ''} />
      </div>
    );
  }

  if (data.recommendations && data.providerStatuses) {
    return (
      <SearchResults
        query={query}
        recommendations={data.recommendations}
        providerStatuses={data.providerStatuses}
      />
    );
  }

  return null;
}
