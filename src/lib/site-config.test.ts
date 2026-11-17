import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMockProvidersEnabled } from './site-config';

describe('mock provider gate', () => {
  it('does not enable mocks when NODE_ENV is production', () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    const previousFlag = env.USE_MOCK_PROVIDERS;
    env.NODE_ENV = 'production';
    env.USE_MOCK_PROVIDERS = 'true';

    try {
      assert.equal(isMockProvidersEnabled(), false);
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
      if (previousFlag === undefined) delete env.USE_MOCK_PROVIDERS;
      else env.USE_MOCK_PROVIDERS = previousFlag;
    }
  });
});
