import type { ProviderAdapter } from './types';
import type { ParsedIntent, ProviderListing, ProviderSearchResult } from '../types';
import type { ProviderDefinition } from './definitions';

export function createNotConfiguredAdapter(def: ProviderDefinition): ProviderAdapter {
  const message = `${def.name} is not configured. Authorized API credentials are required for live data.`;

  const emptyResult = (status: ProviderSearchResult['status']): ProviderSearchResult => ({
    status,
    listings: [],
    message,
    providerSlug: def.slug,
  });

  return {
    slug: def.slug,
    name: def.name,
    category: def.category,
    supportedOperations: [],

    async search(_query: string, _intent: ParsedIntent): Promise<ProviderSearchResult> {
      return emptyResult('NOT_SUPPORTED');
    },

    async getProduct(_merchantProductId: string): Promise<ProviderSearchResult> {
      return emptyResult('NOT_SUPPORTED');
    },

    async getPrice() {
      return { status: 'NOT_SUPPORTED' };
    },

    async getAffiliateLink(_listing: ProviderListing) {
      return { status: 'NOT_SUPPORTED' };
    },

    getProductUrl(listing: ProviderListing): string {
      return listing.url;
    },
  };
}
