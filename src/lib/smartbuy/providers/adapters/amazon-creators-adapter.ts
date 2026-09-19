import type { ParsedIntent, ProviderListing, ProviderSearchResult } from '../types';
import type { ProviderAdapter } from './types';

type AmazonItem = {
  asin?: string;
  detailPageURL?: string;
  images?: { primary?: { medium?: { url?: string } } };
  itemInfo?: {
    title?: { displayValue?: string };
    byLineInfo?: { brand?: { displayValue?: string } };
    productInfo?: Record<string, unknown>;
    technicalInfo?: Record<string, unknown>;
  };
  offersV2?: {
    listings?: Array<{
      availability?: { type?: string; message?: string };
      merchantInfo?: { name?: string };
      isBuyBoxWinner?: boolean;
      price?: {
        money?: { amount?: number; currency?: string };
        savingBasis?: { money?: { amount?: number; currency?: string } };
      };
    }>;
  };
};

type AmazonResponse = {
  searchResult?: { items?: AmazonItem[] };
  itemsResult?: { items?: AmazonItem[] };
};

const API_BASE = process.env.AMAZON_CREATORS_API_BASE_URL || 'https://creatorsapi.amazon';
const MARKETPLACE = process.env.AMAZON_CREATORS_MARKETPLACE || 'www.amazon.in';
const CLIENT_ID = process.env.AMAZON_CREATORS_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CREATORS_CLIENT_SECRET;
const PARTNER_TAG = process.env.AMAZON_CREATORS_PARTNER_TAG;
const VERSION = process.env.AMAZON_CREATORS_VERSION || '3.2';
const TOKEN_ENDPOINT =
  process.env.AMAZON_CREATORS_TOKEN_ENDPOINT ||
  (VERSION === '3.1'
    ? 'https://api.amazon.com/auth/o2/token'
    : VERSION === '3.3'
      ? 'https://api.amazon.co.jp/auth/o2/token'
      : 'https://api.amazon.co.uk/auth/o2/token');

let cachedToken: { value: string; expiresAt: number } | null = null;

export function hasAmazonCreatorsCredentials(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && PARTNER_TAG);
}

async function getToken(): Promise<string> {
  if (!hasAmazonCreatorsCredentials()) throw new Error('Amazon Creators API credentials are not configured.');
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'creatorsapi::default',
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Amazon token request failed: ${response.status}`);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Amazon token response did not contain an access token.');

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in || 3600) * 1000,
  };
  return data.access_token;
}

async function callAmazon(path: string, payload: Record<string, unknown>): Promise<AmazonResponse> {
  const token = await getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-marketplace': MARKETPLACE,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Amazon Creators API ${response.status}: ${body.slice(0, 500)}`);
  }
  return (await response.json()) as AmazonResponse;
}

function mapItem(item: AmazonItem): ProviderListing {
  const offer = item.offersV2?.listings?.find((entry) => entry.isBuyBoxWinner) ||
    item.offersV2?.listings?.[0];
  const price = offer?.price?.money?.amount;
  const mrp = offer?.price?.savingBasis?.money?.amount;
  const currency = offer?.price?.money?.currency || 'INR';

  return {
    merchantProductId: item.asin || '',
    title: item.itemInfo?.title?.displayValue || 'Amazon product',
    brand: item.itemInfo?.byLineInfo?.brand?.displayValue,
    category: 'ECOMMERCE',
    price,
    mrp,
    currency,
    availability: offer?.availability?.message || offer?.availability?.type,
    seller: offer?.merchantInfo?.name,
    url: item.detailPageURL || `https://www.amazon.in/dp/${item.asin || ''}`,
    imageUrl: item.images?.primary?.medium?.url,
    identifiers: item.asin ? { asin: item.asin } : undefined,
    dataFreshness: 'LIVE',
    sourceTimestamp: new Date(),
  };
}

function result(status: ProviderSearchResult['status'], listings: ProviderListing[], message?: string): ProviderSearchResult {
  return { status, listings, providerSlug: 'amazon', message };
}

export function createAmazonCreatorsAdapter(): ProviderAdapter {
  return {
    slug: 'amazon',
    name: 'Amazon India',
    category: 'ECOMMERCE',
    supportedOperations: ['search', 'getProduct', 'getPrice', 'getOffers', 'affiliateLink'],

    async search(query: string, intent: ParsedIntent) {
      if (!hasAmazonCreatorsCredentials()) {
        return result('NOT_SUPPORTED', [], 'Amazon Creators API credentials are not configured.');
      }
      try {
        const payload: Record<string, unknown> = {
          keywords: query,
          marketplace: MARKETPLACE,
          partnerTag: PARTNER_TAG,
          itemCount: 10,
          resources: [
            'images.primary.medium',
            'itemInfo.title',
            'itemInfo.byLineInfo',
            'offersV2.listings.price',
            'offersV2.listings.availability',
            'offersV2.listings.merchantInfo',
            'offersV2.listings.isBuyBoxWinner',
          ],
        };
        if (intent.brand) payload.brand = intent.brand;
        if (intent.budgetMax) payload.maxPrice = Math.round(intent.budgetMax * 100);
        if (intent.budgetMin) payload.minPrice = Math.round(intent.budgetMin * 100);

        const data = await callAmazon('/catalog/v1/searchItems', payload);
        const items = data.searchResult?.items || [];
        return result('OK', items.filter((item) => item.asin).map(mapItem));
      } catch (error) {
        return result('ERROR', [], error instanceof Error ? error.message : 'Amazon API request failed.');
      }
    },

    async getProduct(merchantProductId: string) {
      if (!hasAmazonCreatorsCredentials()) return result('NOT_SUPPORTED', [], 'Amazon Creators API credentials are not configured.');
      try {
        const data = await callAmazon('/catalog/v1/getItems', {
          itemIds: [merchantProductId],
          itemIdType: 'ASIN',
          marketplace: MARKETPLACE,
          partnerTag: PARTNER_TAG,
          resources: [
            'images.primary.medium',
            'itemInfo.title',
            'itemInfo.byLineInfo',
            'offersV2.listings.price',
            'offersV2.listings.availability',
            'offersV2.listings.merchantInfo',
            'offersV2.listings.isBuyBoxWinner',
          ],
        });
        return result('OK', (data.itemsResult?.items || []).filter((item) => item.asin).map(mapItem));
      } catch (error) {
        return result('ERROR', [], error instanceof Error ? error.message : 'Amazon API request failed.');
      }
    },

    async getPrice(merchantProductId: string) {
      const response = await this.getProduct?.(merchantProductId);
      const listing = response?.listings?.[0];
      return listing
        ? { status: response?.status || 'OK', price: listing.price, mrp: listing.mrp }
        : { status: response?.status || 'NOT_SUPPORTED' };
    },

    async getOffers(merchantProductId: string) {
      return this.getProduct!(merchantProductId);
    },

    async getAffiliateLink(listing) {
      if (!listing.url) return { status: 'NOT_SUPPORTED' };
      // Amazon requires API-generated URLs to be used without modifying parameters.
      return { status: 'OK', url: listing.url };
    },

    getProductUrl(listing) {
      return listing.url;
    },
  };
}
