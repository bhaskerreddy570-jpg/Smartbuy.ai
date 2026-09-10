import { MOCK_MERCHANTS } from './providers/mock-data';

const ALLOWED_DOMAINS: Record<string, string[]> = {
  amazon: ['amazon.in', 'www.amazon.in'],
  flipkart: ['flipkart.com', 'www.flipkart.com'],
  croma: ['croma.com', 'www.croma.com'],
};

export function isAllowedRedirectUrl(url: string, merchantSlug: string): boolean {
  try {
    const parsed = new URL(url);
    const allowed = ALLOWED_DOMAINS[merchantSlug];
    if (!allowed) return false;
    return allowed.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function buildAffiliateUrl(
  productUrl: string,
  merchantSlug: string,
): { url: string; isAffiliate: boolean } {
  const merchant = MOCK_MERCHANTS[merchantSlug as keyof typeof MOCK_MERCHANTS];
  if (!merchant?.affiliateTag) {
    return { url: productUrl, isAffiliate: false };
  }

  if (!isAllowedRedirectUrl(productUrl, merchantSlug)) {
    throw new Error('Redirect URL not in merchant allowlist');
  }

  const separator = productUrl.includes('?') ? '&' : '?';
  const paramName = merchantSlug === 'amazon' ? 'tag' : 'affid';
  return {
    url: `${productUrl}${separator}${paramName}=${merchant.affiliateTag}`,
    isAffiliate: true,
  };
}
