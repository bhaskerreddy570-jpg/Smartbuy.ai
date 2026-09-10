import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriceHistoryStats } from './price-history';

describe('calculatePriceHistoryStats', () => {
  it('returns insufficient data with no observations', () => {
    const stats = calculatePriceHistoryStats([]);
    assert.equal(stats.buyRecommendation, 'insufficient_data');
    assert.equal(stats.observationCount, 0);
  });

  it('recommends buy when price is below average', () => {
    const now = new Date();
    const observations = Array.from({ length: 10 }, (_, i) => ({
      price: 55000 + i * 100,
      observedAt: new Date(now.getTime() - (10 - i) * 24 * 60 * 60 * 1000),
    }));
    const stats = calculatePriceHistoryStats(observations, 54000);
    assert.equal(stats.buyRecommendation, 'buy');
    assert.ok(stats.avg30Day);
  });
});
