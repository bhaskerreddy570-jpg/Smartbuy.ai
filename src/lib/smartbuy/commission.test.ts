import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateExpectedCommission, calculateBusinessScore } from './commission';

describe('calculateExpectedCommission', () => {
  it('calculates expected commission', () => {
    const result = calculateExpectedCommission(50000, 0.03, 0.05, 0.1);
    assert.ok(result.estimatedCommission > 0);
    assert.equal(result.commissionRate, 0.03);
    assert.ok(result.estimatedCommission < 50000 * 0.03);
  });
});

describe('calculateBusinessScore', () => {
  it('returns 0 without affiliate', () => {
    assert.equal(calculateBusinessScore(false, 0.03), 0);
  });

  it('returns positive score with affiliate', () => {
    const score = calculateBusinessScore(true, 0.03, 0.05);
    assert.ok(score > 0 && score <= 1);
  });
});
