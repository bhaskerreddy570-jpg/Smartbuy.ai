import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isStoredCustomerSessionRevoked } from './customer-sessions';

describe('customer session revocation', () => {
  it('treats revoked and expired stored sessions as inactive', () => {
    assert.equal(isStoredCustomerSessionRevoked(null), false);
    assert.equal(
      isStoredCustomerSessionRevoked({
        revokedAt: null,
        expiresAt: '2999-01-01T00:00:00.000Z',
      }),
      false,
    );
    assert.equal(
      isStoredCustomerSessionRevoked({
        revokedAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2999-01-01T00:00:00.000Z',
      }),
      true,
    );
    assert.equal(
      isStoredCustomerSessionRevoked({
        revokedAt: null,
        expiresAt: '2000-01-01T00:00:00.000Z',
      }),
      true,
    );
  });

  it('makes Auth.js reject a revoked customer session', () => {
    const authSource = readFileSync(join(import.meta.dirname, '..', '..', 'auth.ts'), 'utf8');
    assert.match(authSource, /isCustomerSessionRevoked/);
    assert.match(authSource, /if \(revoked\) return null/);
  });
});
