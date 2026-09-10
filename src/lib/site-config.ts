/**
 * Central site branding and configuration.
 * Final brand name pending owner approval — use PROJECT_NAME_PLACEHOLDER until then.
 */

export const PROJECT_NAME_PLACEHOLDER = 'PROJECT_NAME_PLACEHOLDER';

export function getSiteName(): string {
  return process.env.NEXT_PUBLIC_SITE_NAME?.trim() || PROJECT_NAME_PLACEHOLDER;
}

export function getSiteTagline(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_TAGLINE?.trim() ||
    'Your personal decision assistant for buying and booking.'
  );
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.AUTH_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export function getSiteDescription(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION?.trim() ||
    'Search, compare, and decide smarter across Indian ecommerce, travel, and ride options. Customer-first recommendations with transparent affiliate disclosure.'
  );
}

export function isMockProvidersEnabled(): boolean {
  const flag = process.env.USE_MOCK_PROVIDERS?.toLowerCase();
  if (flag === 'false' || flag === '0') return false;
  return true;
}

export function getRecommendationWeights() {
  return {
    customerWeight: parseFloat(process.env.CUSTOMER_SCORE_WEIGHT ?? '0.75'),
    businessWeight: parseFloat(process.env.BUSINESS_SCORE_WEIGHT ?? '0.25'),
    matchConfidenceThreshold: parseFloat(process.env.MATCH_CONFIDENCE_THRESHOLD ?? '0.85'),
    /** Business score cannot override when customer gap exceeds this */
    customerDominanceGap: parseFloat(process.env.CUSTOMER_DOMINANCE_GAP ?? '0.15'),
  };
}
