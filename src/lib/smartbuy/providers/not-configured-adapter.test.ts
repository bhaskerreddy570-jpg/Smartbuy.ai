import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getProviderDefinition } from './definitions';
import { createNotConfiguredAdapter } from './not-configured-adapter';

describe('not configured provider adapter', () => {
  it('returns NOT_CONFIGURED and no listings when credentials are absent', async () => {
    const definition = getProviderDefinition('amazon');
    assert.ok(definition);

    const adapter = createNotConfiguredAdapter(definition);
    const result = await adapter.search('iphone', { rawQuery: 'iphone' });

    assert.equal(result.status, 'NOT_CONFIGURED');
    assert.deepEqual(result.listings, []);
    assert.match(result.message ?? '', /not configured/i);
  });
});
