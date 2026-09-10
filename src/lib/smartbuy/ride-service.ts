import type { RideFareEntry } from './types';
import { MOCK_RIDE_PROVIDERS } from './providers/mock-data';

export function getRideProviders(): RideFareEntry[] {
  return MOCK_RIDE_PROVIDERS.map((p) => ({
    providerSlug: p.slug,
    providerName: p.name,
    liveAvailable: p.liveAvailable,
    deepLink: p.deepLink,
    dataSource: 'UNAVAILABLE' as const,
  }));
}

export function compareRideFares(
  fares: Array<{ providerSlug: string; fare: number; etaMinutes?: number }>,
): {
  bestPrice: { providerSlug: string; fare: number } | null;
  savings: Array<{ vsProvider: string; amount: number }>;
} {
  if (fares.length === 0) {
    return { bestPrice: null, savings: [] };
  }

  const sorted = [...fares].sort((a, b) => a.fare - b.fare);
  const best = sorted[0];

  const savings = sorted.slice(1).map((f) => ({
    vsProvider: f.providerSlug,
    amount: f.fare - best.fare,
  }));

  return {
    bestPrice: { providerSlug: best.providerSlug, fare: best.fare },
    savings,
  };
}
