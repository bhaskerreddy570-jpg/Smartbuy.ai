import type { ParsedIntent, ProviderListing, ProviderSearchResult } from '../types';
import type { ProviderAdapter } from './types';
import type { ProviderDefinition } from './definitions';

type GenericResponse = {
  listings?: unknown[];
  products?: unknown[];
  results?: unknown[];
  data?: { listings?: unknown[]; products?: unknown[]; results?: unknown[] };
};

function normalize(value: any, def: ProviderDefinition): ProviderListing | null {
  const id = String(value?.merchantProductId ?? value?.id ?? value?.sku ?? value?.productId ?? '').trim();
  const title = String(value?.title ?? value?.name ?? '').trim();
  const url = String(value?.affiliateUrl ?? value?.productUrl ?? value?.url ?? '').trim();
  if (!id || !title || !url) return null;

  return {
    merchantProductId: id,
    title,
    brand: value?.brand ? String(value.brand) : undefined,
    model: value?.model ? String(value.model) : undefined,
    category: String(value?.category ?? def.category),
    subcategory: value?.subcategory ? String(value.subcategory) : undefined,
    price: typeof value?.price === 'number' ? value.price : undefined,
    mrp: typeof value?.mrp === 'number' ? value.mrp : undefined,
    currency: String(value?.currency ?? 'INR'),
    availability: value?.availability ? String(value.availability) : undefined,
    seller: value?.seller ? String(value.seller) : undefined,
    rating: typeof value?.rating === 'number' ? value.rating : undefined,
    reviewCount: typeof value?.reviewCount === 'number' ? value.reviewCount : undefined,
    url,
    affiliateUrl: value?.affiliateUrl ? String(value.affiliateUrl) : undefined,
    imageUrl: value?.imageUrl ? String(value.imageUrl) : undefined,
    specifications: value?.specifications && typeof value.specifications === 'object' ? value.specifications : undefined,
    identifiers: value?.identifiers && typeof value.identifiers === 'object' ? value.identifiers : undefined,
    dataFreshness: 'LIVE',
    sourceTimestamp: new Date(),
  };
}

export function createAuthorizedFeedAdapter(def: ProviderDefinition): ProviderAdapter {
  const baseUrl = process.env[`${def.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_BASE_URL`];
  const token = process.env[`${def.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_TOKEN`];

  const searchUrl = process.env[`${def.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_SEARCH_URL`];
  const endpoint = searchUrl || (baseUrl ? `${baseUrl.replace(/\\/$/, '')}/search` : undefined);

  async function search(query: string, intent: ParsedIntent): Promise<ProviderSearchResult> {
    if (!endpoint || !token) {
      return {
        status: 'NOT_SUPPORTED',
        listings: [],
        providerSlug: def.slug,
        message: `${def.name} is not configured with an authorized API/feed endpoint.`,
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-smartbuy-provider': def.slug,
        },
        body: JSON.stringify({ query, intent }),
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`${def.name} API returned ${response.status}`);
      const payload = (await response.json()) as GenericResponse;
      const raw = payload.listings || payload.products || payload.results ||
        payload.data?.listings || payload.data?.products || payload.data?.results || [];
      const listings = raw.map((item) => normalize(item, def)).filter(Boolean) as ProviderListing[];
      return { status: 'OK', listings, providerSlug: def.slug };
    } catch (error) {
      return {
        status: 'ERROR',
        listings: [],
        providerSlug: def.slug,
        message: error instanceof Error ? error.message : `${def.name} API request failed.`,
      };
    }
  }

  return {
    slug: def.slug,
    name: def.name,
    category: def.category,
    supportedOperations: ['search', 'affiliateLink'],
    search,
    async getAffiliateLink(listing) {
      return listing.affiliateUrl || listing.url
        ? { status: 'OK', url: listing.affiliateUrl || listing.url }
        : { status: 'NOT_SUPPORTED' };
    },
    getProductUrl: (listing) => listing.url,
  };
}
