import type { ProviderAdapter } from './types';
import type { ParsedIntent, ProviderListing, ProviderSearchResult } from '../types';
import { MOCK_LISTINGS, MOCK_MERCHANTS } from './mock-data';

function matchesIntent(listing: ProviderListing, intent: ParsedIntent, query: string): boolean {
  const q = query.toLowerCase();
  const title = listing.title.toLowerCase();
  const brand = listing.brand?.toLowerCase() ?? '';
  const model = listing.model?.toLowerCase() ?? '';
  const category = listing.category.toLowerCase();

  if (intent.category && !category.includes(intent.category.toLowerCase())) {
    const categoryAliases: Record<string, string[]> = {
      smartphone: ['smartphones', 'mobile', 'phone'],
      laptop: ['laptops', 'notebook'],
      television: ['electronics', 'tv', 'television'],
      washing_machine: ['home_appliances', 'washing'],
      ride: [],
      travel: [],
    };
    const aliases = categoryAliases[intent.category.toLowerCase()] ?? [intent.category.toLowerCase()];
    if (!aliases.some((a) => category.includes(a))) {
      return false;
    }
  }

  if (intent.brand && !brand.includes(intent.brand.toLowerCase())) {
    return false;
  }

  if (intent.model && !model.includes(intent.model.toLowerCase()) && !title.includes(intent.model.toLowerCase())) {
    return false;
  }

  if (intent.budgetMax && listing.price && listing.price > intent.budgetMax) {
    return false;
  }

  const queryTerms = q.split(/\s+/).filter((t) => t.length > 2);
  if (queryTerms.length === 0) return true;

  const searchable = `${title} ${brand} ${model} ${category} ${JSON.stringify(listing.specifications ?? {})}`;
  const matchCount = queryTerms.filter((term) => searchable.includes(term)).length;
  return matchCount >= Math.ceil(queryTerms.length * 0.4);
}

export function createMockAdapter(providerSlug: string): ProviderAdapter {
  const merchant = MOCK_MERCHANTS[providerSlug as keyof typeof MOCK_MERCHANTS];
  const listings = MOCK_LISTINGS[providerSlug] ?? [];

  return {
    slug: providerSlug,
    name: merchant?.name ?? providerSlug,
    category: 'ECOMMERCE',
    supportedOperations: ['search', 'getProduct', 'getPrice', 'getAffiliateLink', 'getProductUrl'],

    async search(query: string, intent: ParsedIntent): Promise<ProviderSearchResult> {
      const filtered = listings.filter((l) => matchesIntent(l, intent, query));
      return {
        status: 'OK',
        listings: filtered,
        providerSlug,
      };
    },

    async getProduct(merchantProductId: string): Promise<ProviderSearchResult> {
      const listing = listings.find((l) => l.merchantProductId === merchantProductId);
      if (!listing) {
        return { status: 'ERROR', listings: [], message: 'Product not found', providerSlug };
      }
      return { status: 'OK', listings: [listing], providerSlug };
    },

    async getPrice(merchantProductId: string) {
      const listing = listings.find((l) => l.merchantProductId === merchantProductId);
      if (!listing) return { status: 'ERROR' };
      return { status: 'OK', price: listing.price, mrp: listing.mrp };
    },

    async getAffiliateLink(listing: ProviderListing) {
      const tag = merchant?.affiliateTag;
      if (!tag) return { status: 'NOT_SUPPORTED' };
      const separator = listing.url.includes('?') ? '&' : '?';
      return { status: 'OK', url: `${listing.url}${separator}tag=${tag}` };
    },

    getProductUrl(listing: ProviderListing): string {
      return listing.url;
    },
  };
}
