import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateRecommendations, applyCustomerFirstRanking } from './recommendation';
import type { ParsedIntent, ProviderListing, ScoredListing } from './types';

const baseIntent: ParsedIntent = { rawQuery: 'laptop under 70000', category: 'laptops', budgetMax: 70000 };

function listing(overrides: Partial<ProviderListing> & { merchantProductId: string; price: number }): ProviderListing {
  return {
    title: overrides.title ?? 'Test Product',
    category: 'laptops',
    currency: 'INR',
    url: 'https://www.amazon.in/dp/test',
    dataFreshness: 'LIVE',
    availability: 'In Stock',
    rating: overrides.rating ?? 4,
    ...overrides,
  };
}

describe('generateRecommendations — customer-first scoring', () => {
  it('prefers excellent low-commission product over inferior high-commission product', () => {
    const excellent: ProviderListing = listing({
      merchantProductId: 'EX-1',
      price: 65000,
      rating: 4.8,
      title: 'ASUS TUF Gaming F15',
    });
    const inferior: ProviderListing = listing({
      merchantProductId: 'INF-1',
      price: 69900,
      rating: 3.2,
      title: 'Unknown Brand Laptop',
    });

    const result = generateRecommendations(
      [
        { listing: excellent, merchantSlug: 'amazon' },
        { listing: inferior, merchantSlug: 'flipkart' },
      ],
      baseIntent,
    );

    assert.equal(result.bestOverall?.listing.merchantProductId, 'EX-1');
  });

  it('does not recommend clearly inferior product solely due to commission', () => {
    const highCommissionBad: ProviderListing = listing({
      merchantProductId: 'HC-1',
      price: 68000,
      rating: 2.5,
      sellerRating: 2,
      availability: 'Out of Stock',
    });
    const lowCommissionGood: ProviderListing = listing({
      merchantProductId: 'LC-1',
      price: 67000,
      rating: 4.6,
      sellerRating: 4.5,
      warranty: '2 years',
      returnPolicy: '7 days',
    });

    const result = generateRecommendations(
      [
        { listing: highCommissionBad, merchantSlug: 'flipkart' },
        { listing: lowCommissionGood, merchantSlug: 'croma' },
      ],
      baseIntent,
    );

    assert.equal(result.bestOverall?.listing.merchantProductId, 'LC-1');
  });

  it('uses commission as tiebreaker when customer scores are similar', () => {
    const a: ProviderListing = listing({ merchantProductId: 'A', price: 65000, rating: 4.2 });
    const b: ProviderListing = listing({ merchantProductId: 'B', price: 65100, rating: 4.2 });

    const result = generateRecommendations(
      [
        { listing: a, merchantSlug: 'amazon' },
        { listing: b, merchantSlug: 'flipkart' },
      ],
      baseIntent,
    );

    assert.ok(result.bestOverall);
    assert.ok(['A', 'B'].includes(result.bestOverall!.listing.merchantProductId));
  });

  it('marks cheapest listing correctly', () => {
    const cheap: ProviderListing = listing({ merchantProductId: 'CHEAP', price: 60000, rating: 3.5 });
    const expensive: ProviderListing = listing({
      merchantProductId: 'EXP',
      price: 69000,
      rating: 4.9,
      warranty: '2 years',
      returnPolicy: '10 days',
    });

    const result = generateRecommendations(
      [
        { listing: expensive, merchantSlug: 'amazon' },
        { listing: cheap, merchantSlug: 'flipkart' },
      ],
      baseIntent,
    );

    assert.equal(result.cheapest?.listing.merchantProductId, 'CHEAP');
    if (result.cheapest?.listing.merchantProductId !== result.bestOverall?.listing.merchantProductId) {
      assert.equal(result.cheapest?.badge, 'CHEAPEST');
    }
  });

  it('handles missing commission data gracefully', () => {
    const result = generateRecommendations(
      [{ listing: listing({ merchantProductId: 'X', price: 50000 }), merchantSlug: 'unknown-merchant' }],
      baseIntent,
    );
    assert.ok(result.bestOverall);
    assert.equal(result.bestOverall?.businessScore, 0);
  });
});

describe('applyCustomerFirstRanking', () => {
  it('ranks by customer score when gap exceeds dominance threshold', () => {
    const items: ScoredListing[] = [
      {
        listing: listing({ merchantProductId: '1', price: 100 }),
        merchantSlug: 'amazon',
        merchantName: 'Amazon',
        customerScore: 0.9,
        businessScore: 0.1,
        combinedScore: 0.7,
        explanation: [],
        dataFreshnessLabel: 'Live',
      },
      {
        listing: listing({ merchantProductId: '2', price: 100 }),
        merchantSlug: 'flipkart',
        merchantName: 'Flipkart',
        customerScore: 0.5,
        businessScore: 0.95,
        combinedScore: 0.6,
        explanation: [],
        dataFreshnessLabel: 'Live',
      },
    ];

    const ranked = applyCustomerFirstRanking(items, {
      customerWeight: 0.75,
      businessWeight: 0.25,
      matchConfidenceThreshold: 0.85,
    });

    assert.equal(ranked[0].listing.merchantProductId, '1');
  });
});
