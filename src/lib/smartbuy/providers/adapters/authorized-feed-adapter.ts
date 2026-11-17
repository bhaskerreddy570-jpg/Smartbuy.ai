import type { ParsedIntent, ProviderListing, ProviderSearchResult } from '../../types';
import type { ProviderAdapter } from '../types';
import type { ProviderDefinition } from '../definitions';

type GenericResponse = {
  listings?: unknown[];
  products?: unknown[];
  results?: unknown[];
  data?: { listings?: unknown[]; products?: unknown[]; results?: unknown[] };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const entries: Array<[string, string]> = [];
  for (const [key, entry] of Object.entries(record)) {
    const text = readString(entry);
    if (text) entries.push([key, text]);
  }

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function normalize(value: unknown, def: ProviderDefinition): ProviderListing | null {
  const record = asRecord(value);
  if (!record) return null;

  const id = readString(record.merchantProductId ?? record.id ?? record.sku ?? record.productId);
  const title = readString(record.title ?? record.name);
  const url = readString(record.affiliateUrl ?? record.productUrl ?? record.url);
  if (!id || !title || !url) return null;

  const brand = readString(record.brand);
  const model = readString(record.model);
  const subcategory = readString(record.subcategory);
  const availability = readString(record.availability);
  const seller = readString(record.seller);
  const affiliateUrl = readString(record.affiliateUrl);
  const imageUrl = readString(record.imageUrl);

  return {
    merchantProductId: id,
    title,
    brand: brand || undefined,
    model: model || undefined,
    category: readString(record.category) || def.category,
    subcategory: subcategory || undefined,
    price: readNumber(record.price),
    mrp: readNumber(record.mrp),
    currency: readString(record.currency) || 'INR',
    availability: availability || undefined,
    seller: seller || undefined,
    rating: readNumber(record.rating),
    reviewCount: readNumber(record.reviewCount),
    url,
    affiliateUrl: affiliateUrl || undefined,
    imageUrl: imageUrl || undefined,
    specifications: readStringRecord(record.specifications),
    identifiers: readStringRecord(record.identifiers),
    dataFreshness: 'LIVE',
    sourceTimestamp: new Date(),
  };
}

export function createAuthorizedFeedAdapter(def: ProviderDefinition): ProviderAdapter {
  const baseUrl = process.env[`${def.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_BASE_URL`];
  const token = process.env[`${def.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_TOKEN`];

  const searchUrl = process.env[`${def.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_SEARCH_URL`];
  const endpoint = searchUrl || (baseUrl ? `${baseUrl.replace(/\/$/, '')}/search` : undefined);

  async function search(query: string, intent: ParsedIntent): Promise<ProviderSearchResult> {
    if (!endpoint || !token) {
      return {
        status: 'NOT_CONFIGURED',
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
