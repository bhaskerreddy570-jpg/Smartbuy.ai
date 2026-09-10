import { MOCK_MERCHANTS } from './providers/mock-data';
import { getAllowedDomainsMap, getProviderDefinition } from './providers/definitions';

const ALLOWED_DOMAINS = getAllowedDomainsMap();

export function isAllowedRedirectUrl(url: string, merchantSlug: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;

    const allowed = ALLOWED_DOMAINS[merchantSlug];
    if (!allowed?.length) return false;

    return allowed.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function getAffiliateTag(merchantSlug: string): string | undefined {
  const mock = MOCK_MERCHANTS[merchantSlug as keyof typeof MOCK_MERCHANTS];
  if (mock?.affiliateTag) return mock.affiliateTag;

  const def = getProviderDefinition(merchantSlug);
  if (merchantSlug === 'amazon') {
    const tag = process.env.AMAZON_ASSOCIATE_TAG?.trim();
    if (tag) return tag;
  }
  if (merchantSlug === 'flipkart') {
    const id = process.env.FLIPKART_AFFILIATE_ID?.trim();
    if (id) return id;
  }

  return undefined;
}

export function buildAffiliateUrl(
  productUrl: string,
  merchantSlug: string,
): { url: string; isAffiliate: boolean } {
  if (!isAllowedRedirectUrl(productUrl, merchantSlug)) {
    throw new Error('Redirect URL not in merchant allowlist');
  }

  const tag = getAffiliateTag(merchantSlug);
  if (!tag) {
    return { url: productUrl, isAffiliate: false };
  }

  const def = getProviderDefinition(merchantSlug);
  const paramName = def?.affiliateParam ?? (merchantSlug === 'amazon' ? 'tag' : 'affid');
  const separator = productUrl.includes('?') ? '&' : '?';

  return {
    url: `${productUrl}${separator}${paramName}=${encodeURIComponent(tag)}`,
    isAffiliate: true,
  };
}

/** Reject redirect URLs passed as query params — only server-built URLs allowed */
export function validateRedirectParams(merchantSlug: string | null, productId: string | null): boolean {
  if (!merchantSlug || !productId) return false;
  if (merchantSlug.includes('/') || merchantSlug.includes('://')) return false;
  if (productId.includes('/') || productId.includes('://')) return false;
  return /^[a-z0-9_-]+$/i.test(merchantSlug) && productId.length <= 200;
}
