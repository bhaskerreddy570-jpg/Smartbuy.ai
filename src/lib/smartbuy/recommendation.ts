import type {
  ParsedIntent,
  ProviderListing,
  RecommendationResult,
  RecommendationWeights,
  ScoredListing,
} from './types';
import { calculateBusinessScore } from './commission';
import { calculateSavings, findHighestPrice } from './savings';
import { groupListingsByProduct } from './product-matcher';
import { MOCK_MERCHANTS } from './providers/mock-data';
import { getProviderDefinition } from './providers/definitions';
import { getRecommendationWeights } from '@/lib/site-config';

export function getDefaultWeights(): RecommendationWeights {
  const w = getRecommendationWeights();
  return {
    customerWeight: w.customerWeight,
    businessWeight: w.businessWeight,
    matchConfidenceThreshold: w.matchConfidenceThreshold,
  };
}

function getMerchantCommissionRate(merchantSlug: string): number {
  const mock = MOCK_MERCHANTS[merchantSlug as keyof typeof MOCK_MERCHANTS];
  if (mock?.commissionRate) return mock.commissionRate;
  const def = getProviderDefinition(merchantSlug);
  return def?.commissionRate ?? 0;
}

function getMerchantName(merchantSlug: string): string {
  const mock = MOCK_MERCHANTS[merchantSlug as keyof typeof MOCK_MERCHANTS];
  if (mock?.name) return mock.name;
  const def = getProviderDefinition(merchantSlug);
  return def?.name ?? merchantSlug;
}

function formatFreshnessLabel(freshness: string, timestamp?: Date): string {
  if (!timestamp) {
    return freshness === 'LIVE' ? 'Live' : freshness.replace(/_/g, ' ');
  }
  const mins = Math.round((Date.now() - timestamp.getTime()) / 60000);
  if (mins < 1) return 'Live — updated just now';
  if (mins < 60) return `Live — updated ${mins} minute${mins > 1 ? 's' : ''} ago`;
  if (mins < 1440) return `Updated ${Math.round(mins / 60)} hour${mins >= 120 ? 's' : ''} ago`;
  return 'Updated today';
}

function calculateCustomerScore(
  listing: ProviderListing,
  intent: ParsedIntent,
  priceRank: number,
  totalListings: number,
): number {
  let score = 0;

  if (listing.price) {
    const priceScore = 1 - priceRank / Math.max(totalListings, 1);
    score += priceScore * 0.35;
  }

  if (listing.rating) {
    score += (listing.rating / 5) * 0.2;
  }

  if (listing.sellerRating) {
    score += (listing.sellerRating / 5) * 0.1;
  }

  if (listing.availability?.toLowerCase().includes('stock')) {
    score += 0.1;
  }

  if (listing.warranty) score += 0.05;
  if (listing.returnPolicy) score += 0.05;

  if (intent.budgetMax && listing.price && listing.price <= intent.budgetMax) {
    score += 0.1;
  }

  if (intent.useCase && listing.specifications) {
    const specs = JSON.stringify(listing.specifications).toLowerCase();
    if (specs.includes(intent.useCase.toLowerCase())) {
      score += 0.05;
    }
  }

  return Math.min(score, 1);
}

function buildExplanation(
  listing: ScoredListing,
  isCheapest: boolean,
  matchConfidence?: number,
  merchantCount?: number,
): string[] {
  const reasons: string[] = [];

  if (matchConfidence && matchConfidence >= 0.85 && merchantCount && merchantCount > 1) {
    reasons.push(`Same model confirmed across ${merchantCount} stores`);
  }

  if (isCheapest && listing.listing.price) {
    reasons.push('Lowest verified current price among supported sources');
  }

  if (listing.listing.rating && listing.listing.rating >= 4) {
    reasons.push(`Good rating (${listing.listing.rating}/5)`);
  }

  if (listing.listing.warranty) {
    reasons.push('Warranty included');
  }

  if (listing.listing.sellerRating && listing.listing.sellerRating >= 4) {
    reasons.push('Reliable seller');
  }

  if (listing.savingsVsHighest && listing.savingsVsHighest > 0) {
    reasons.push(`Save ₹${listing.savingsVsHighest.toLocaleString('en-IN')} vs highest price`);
  }

  return reasons.length > 0 ? reasons : ['Matches your search criteria'];
}

/**
 * Customer value must dominate: business score cannot override when customer gap is significant.
 */
export function applyCustomerFirstRanking(
  scored: ScoredListing[],
  weights: RecommendationWeights,
): ScoredListing[] {
  const dominanceGap = getRecommendationWeights().customerDominanceGap;

  return [...scored].sort((a, b) => {
    const customerGap = a.customerScore - b.customerScore;
    if (Math.abs(customerGap) >= dominanceGap) {
      return b.customerScore - a.customerScore;
    }
    const combinedA =
      a.customerScore * weights.customerWeight + a.businessScore * weights.businessWeight;
    const combinedB =
      b.customerScore * weights.customerWeight + b.businessScore * weights.businessWeight;
    return combinedB - combinedA;
  });
}

export function generateRecommendations(
  allListings: Array<{ listing: ProviderListing; merchantSlug: string }>,
  intent: ParsedIntent,
  weights: RecommendationWeights = getDefaultWeights(),
): RecommendationResult {
  const groups = groupListingsByProduct(allListings, weights.matchConfidenceThreshold);

  const scored: ScoredListing[] = [];

  for (const { listing, merchantSlug } of allListings) {
    const merchantName = getMerchantName(merchantSlug);
    const commissionRate = getMerchantCommissionRate(merchantSlug);

    const pricesWithMerchant = allListings
      .filter((l) => l.listing.price)
      .map((l) => ({
        price: l.listing.price!,
        merchant: getMerchantName(l.merchantSlug),
      }));

    const sortedPrices = [...pricesWithMerchant].sort((a, b) => a.price - b.price);
    const priceRank = sortedPrices.findIndex((p) => p.price === listing.price);

    const customerScore = calculateCustomerScore(listing, intent, priceRank, allListings.length);
    const businessScore = calculateBusinessScore(commissionRate > 0, commissionRate);

    const highest = findHighestPrice(pricesWithMerchant);
    let savingsVsHighest: number | undefined;
    let savingsPercent: number | undefined;

    if (listing.price && highest && highest.price > listing.price) {
      const savings = calculateSavings(listing.price, highest.price, highest.merchant);
      if (savings.isValid) {
        savingsVsHighest = savings.amount;
        savingsPercent = savings.percent;
      }
    }

    scored.push({
      listing,
      merchantSlug,
      merchantName,
      customerScore,
      businessScore,
      combinedScore:
        customerScore * weights.customerWeight + businessScore * weights.businessWeight,
      savingsVsHighest,
      savingsPercent,
      dataFreshnessLabel: formatFreshnessLabel(
        listing.dataFreshness,
        listing.sourceTimestamp,
      ),
      explanation: [],
    });
  }

  const ranked = applyCustomerFirstRanking(scored, weights);

  const validPrices = ranked.filter((s) => s.listing.price);
  const cheapestByPrice = [...validPrices].sort(
    (a, b) => (a.listing.price ?? 0) - (b.listing.price ?? 0),
  );

  const bestOverall = ranked[0] ?? null;
  const cheapest = cheapestByPrice[0] ?? null;

  if (bestOverall) {
    const group = groups.find((g) =>
      g.listings.some((l) => l.listing.merchantProductId === bestOverall.listing.merchantProductId),
    );
    bestOverall.badge = 'BEST_OVERALL';
    bestOverall.explanation = buildExplanation(
      bestOverall,
      cheapest?.listing.merchantProductId === bestOverall.listing.merchantProductId,
      group?.matchConfidence,
      group?.listings.length,
    );
    bestOverall.matchConfidence = group?.matchConfidence;
  }

  if (cheapest && cheapest.listing.merchantProductId !== bestOverall?.listing.merchantProductId) {
    cheapest.badge = 'CHEAPEST';
    const group = groups.find((g) =>
      g.listings.some((l) => l.listing.merchantProductId === cheapest.listing.merchantProductId),
    );
    cheapest.explanation = buildExplanation(cheapest, true, group?.matchConfidence, group?.listings.length);
    cheapest.matchConfidence = group?.matchConfidence;
  }

  const matchedGroups = groups.map((g) => ({
    canonicalKey: g.canonicalKey,
    matchConfidence: g.matchConfidence,
    listings: g.listings
      .map(({ listing, merchantSlug }) => {
        const found = ranked.find((s) => s.listing.merchantProductId === listing.merchantProductId);
        return found!;
      })
      .filter(Boolean),
  }));

  return {
    bestOverall,
    cheapest,
    allListings: ranked,
    matchedGroups,
  };
}

export const DEFAULT_WEIGHTS = getDefaultWeights;
