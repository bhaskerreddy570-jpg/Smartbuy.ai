import { generateRecommendations } from './recommendation';
import { getActiveProviderAdapters } from './providers/registry';
import { getAIProvider } from '@/lib/ai';
import { persistSearch, completeSearch } from './repositories/search-repository';
import { recordPriceObservation } from './repositories/price-repository';
import { resolveMerchantIdBySlug } from './repositories/merchant-repository';
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
  options?: { searchId?: string; userId?: string | null; sessionId?: string | null },
): Promise<SearchResponse> {
  const searchId = options?.searchId ?? crypto.randomUUID();

  const ai = getAIProvider();
  const aiResult = await ai.parseIntent(query);
  const intent = aiResult.intent;

  await persistSearch(searchId, query, intent, options?.userId, options?.sessionId);

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
      providerStatuses.push({
        provider: 'unknown',
        status: 'ERROR',
        count: 0,
        message: 'Provider temporarily unavailable',
      });
      unavailableProviders.push('unknown');
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
      if (result.status === 'UNAVAILABLE' || result.status === 'ERROR' || result.status === 'NOT_SUPPORTED') {
        unavailableProviders.push(adapter.name);
      }
    }
  }

  const recommendations = generateRecommendations(allListings, intent);

  void completeSearch(searchId, recommendations);

  for (const item of recommendations.allListings) {
    if (!item.listing.price || !item.canonicalProductId) continue;
    const merchantId = await resolveMerchantIdBySlug(item.merchantSlug);
    if (!merchantId) continue;
    void recordPriceObservation({
      productId: item.canonicalProductId,
      merchantId,
      listingId: item.canonicalProductId,
      price: item.listing.price,
      mrp: item.listing.mrp,
      availability: item.listing.availability,
      source: item.merchantSlug,
    });
  }

  return {
    searchId,
    query,
    intent,
    recommendations,
    providerStatuses,
    unavailableProviders,
  };
}
