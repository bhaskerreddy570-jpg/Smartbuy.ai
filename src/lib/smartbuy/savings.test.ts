import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateSavings, findLowestPrice, findHighestPrice } from './savings';

describe('calculateSavings', () => {
  it('calculates savings correctly', () => {
    const result = calculateSavings(54999, 56490, 'Amazon');
    assert.equal(result.isValid, true);
    assert.equal(result.amount, 1491);
    assert.ok(result.percent > 2.6 && result.percent < 2.7);
  });

  it('returns invalid when price is not lower', () => {
    const result = calculateSavings(60000, 55000, 'Flipkart');
    assert.equal(result.isValid, false);
    assert.equal(result.amount, 0);
  });
});

describe('findLowestPrice', () => {
  it('finds the lowest price', () => {
    const prices = [
      { price: 56490, merchant: 'Amazon' },
      { price: 54999, merchant: 'Flipkart' },
      { price: 58999, merchant: 'Croma' },
    ];
    const lowest = findLowestPrice(prices);
    assert.equal(lowest?.merchant, 'Flipkart');
    assert.equal(lowest?.price, 54999);
  });
});

describe('findHighestPrice', () => {
  it('finds the highest price', () => {
    const prices = [
      { price: 56490, merchant: 'Amazon' },
      { price: 54999, merchant: 'Flipkart' },
    ];
    const highest = findHighestPrice(prices);
    assert.equal(highest?.merchant, 'Amazon');
  });
});
