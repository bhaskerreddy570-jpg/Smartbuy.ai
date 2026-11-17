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

  it('keeps an existing affiliate parameter instead of appending another', () => {
    const { url, isAffiliate } = buildAffiliateUrl(
      'https://www.amazon.in/dp/B123?tag=real-tag-21',
      'amazon',
    );
    assert.equal(isAffiliate, true);
    assert.equal(url, 'https://www.amazon.in/dp/B123?tag=real-tag-21');
  });

  it('does not apply mock affiliate tags when mock providers are disabled', () => {
    const previous = process.env.USE_MOCK_PROVIDERS;
    const previousPartnerTag = process.env.AMAZON_CREATORS_PARTNER_TAG;
    const previousAssociateTag = process.env.AMAZON_ASSOCIATE_TAG;
    process.env.USE_MOCK_PROVIDERS = 'false';
    delete process.env.AMAZON_CREATORS_PARTNER_TAG;
    delete process.env.AMAZON_ASSOCIATE_TAG;

    try {
      const { url, isAffiliate } = buildAffiliateUrl(
        'https://www.amazon.in/dp/B123',
        'amazon',
      );
      assert.equal(isAffiliate, false);
      assert.equal(url, 'https://www.amazon.in/dp/B123');
    } finally {
      if (previous === undefined) delete process.env.USE_MOCK_PROVIDERS;
      else process.env.USE_MOCK_PROVIDERS = previous;
      if (previousPartnerTag === undefined) delete process.env.AMAZON_CREATORS_PARTNER_TAG;
      else process.env.AMAZON_CREATORS_PARTNER_TAG = previousPartnerTag;
      if (previousAssociateTag === undefined) delete process.env.AMAZON_ASSOCIATE_TAG;
      else process.env.AMAZON_ASSOCIATE_TAG = previousAssociateTag;
    }
  });
});
