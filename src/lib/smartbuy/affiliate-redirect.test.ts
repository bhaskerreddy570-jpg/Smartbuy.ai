import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedRedirectUrl, buildAffiliateUrl } from './affiliate-redirect';

describe('affiliate redirect security', () => {
  it('allows amazon.in URLs', () => {
    assert.equal(
      isAllowedRedirectUrl('https://www.amazon.in/dp/B123', 'amazon'),
      true,
    );
  });

  it('rejects unknown domains', () => {
    assert.equal(
      isAllowedRedirectUrl('https://evil.com/phish', 'amazon'),
      false,
    );
  });

  it('builds affiliate URL for amazon', () => {
    const { url, isAffiliate } = buildAffiliateUrl(
      'https://www.amazon.in/dp/B123',
      'amazon',
    );
    assert.equal(isAffiliate, true);
    assert.ok(url.includes('tag=smartbuy-21'));
  });

  it('rejects non-allowlisted URLs', () => {
    assert.throws(() =>
      buildAffiliateUrl('https://evil.com/product', 'amazon'),
    );
  });
});
