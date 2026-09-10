import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from './intent-parser';

describe('parseIntent', () => {
  it('parses laptop budget query', () => {
    const intent = parseIntent('Best laptop under 70000 with 16GB RAM for gaming');
    assert.equal(intent.category, 'laptops');
    assert.equal(intent.budgetMax, 70000);
    assert.equal(intent.useCase, 'gaming');
    assert.equal(intent.attributes?.ram, '16GB');
  });

  it('parses iPhone search', () => {
    const intent = parseIntent('Find the cheapest iPhone 17 256GB');
    assert.equal(intent.category, 'smartphones');
    assert.equal(intent.brand, 'Apple');
    assert.ok(intent.priorities?.includes('price'));
  });

  it('detects ride queries', () => {
    const intent = parseIntent('Check my ride options from Hyderabad Airport to HITEC City');
    assert.equal(intent.queryType, 'ride');
  });

  it('detects TV query', () => {
    const intent = parseIntent('Which website has the cheapest Samsung TV?');
    assert.equal(intent.queryType, 'compare');
    assert.equal(intent.brand, 'Samsung');
  });
});
