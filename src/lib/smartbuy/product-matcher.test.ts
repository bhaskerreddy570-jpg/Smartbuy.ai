import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchListings } from './product-matcher';
import type { ProviderListing } from './types';

const baseListing = (overrides: Partial<ProviderListing>): ProviderListing => ({
  merchantProductId: 'test-1',
  title: 'Apple iPhone 17 256GB Black',
  brand: 'Apple',
  model: 'iPhone 17',
  category: 'smartphones',
  currency: 'INR',
  price: 82900,
  url: 'https://example.com',
  dataFreshness: 'LIVE',
  specifications: { storage: '256GB', color: 'Black' },
  identifiers: { model: 'A3101', gtin: '0194253801234' },
  ...overrides,
});

describe('matchListings', () => {
  it('matches same product across merchants', () => {
    const amazon = baseListing({
      merchantProductId: 'AMZ-1',
      title: 'Apple iPhone 17 256GB Black',
    });
    const flipkart = baseListing({
      merchantProductId: 'FK-1',
      title: 'Apple iPhone 17 (256 GB, Black)',
    });

    const result = matchListings(amazon, flipkart);
    assert.equal(result.isSameProduct, true);
    assert.ok(result.confidence >= 0.85);
  });

  it('does not match different storage variants', () => {
    const listing128 = baseListing({
      specifications: { storage: '128GB', color: 'Black' },
      identifiers: { model: 'A3100', gtin: '0194253801235' },
    });
    const listing256 = baseListing({
      specifications: { storage: '256GB', color: 'Black' },
      identifiers: { model: 'A3101', gtin: '0194253801234' },
    });

    const result = matchListings(listing128, listing256);
    assert.equal(result.isSameProduct, false);
  });

  it('does not match different brands', () => {
    const apple = baseListing({ brand: 'Apple' });
    const samsung = baseListing({
      brand: 'Samsung',
      model: 'Galaxy S25',
      identifiers: { model: 'SM-S925' },
    });

    const result = matchListings(apple, samsung);
    assert.equal(result.isSameProduct, false);
    assert.equal(result.confidence, 0);
  });
});
