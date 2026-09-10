import { parseIntent } from './intent-parser';
import { generateRecommendations } from './recommendation';
import { getActiveProviderAdapters } from './providers/registry';
import type { ParsedIntent, ProviderListing, RecommendationResult } from './types';

export interface SearchResponse {
  searchId: string;
  query: string;
  intent: ParsedIntent;
  recommendations: RecommendationResult;
  providerStatuses: Array<{ provider: string; status: string; count: number; message?: string }>;
  unavailableProviders: string[];
}

export async function executeSearch(
  query: string,
  searchId?: string,
): Promise<SearchResponse> {
  const intent = parseIntent(query);
  const adapters = getActiveProviderAdapters();

  const allListings: Array<{ listing: ProviderListing; merchantSlug: string }> = [];
  const providerStatuses: SearchResponse['providerStatuses'] = [];
  const unavailableProviders: string[] = [];

  const results = await Promise.allSettled(
    adapters.map(async (adapter) => {
      const result = await adapter.search(query, intent);
      return { adapter, result };
    }),
  );

  for (const settled of results) {
    if (settled.status === 'rejected') {
      const slug = 'unknown';
      providerStatuses.push({ provider: slug, status: 'ERROR', count: 0, message: 'Provider temporarily unavailable' });
      unavailableProviders.push(slug);
      continue;
    }

    const { adapter, result } = settled.value;

    if (result.status === 'OK') {
      for (const listing of result.listings) {
        allListings.push({ listing, merchantSlug: adapter.slug });
      }
      providerStatuses.push({
        provider: adapter.name,
        status: 'OK',
        count: result.listings.length,
      });
    } else {
      providerStatuses.push({
        provider: adapter.name,
        status: result.status,
        count: 0,
        message: result.message ?? `${adapter.name} temporarily unavailable`,
      });
      if (result.status === 'UNAVAILABLE' || result.status === 'ERROR') {
        unavailableProviders.push(adapter.name);
      }
    }
  }

  const recommendations = generateRecommendations(allListings, intent);

  return {
    searchId: searchId ?? crypto.randomUUID(),
    query,
    intent,
    recommendations,
    providerStatuses,
    unavailableProviders,
  };
}
