import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { hasAdminRole } from './authorization';
import { hashSessionToken } from './session';
import { isCustomerAccountLocked } from './customer-accounts';

describe('admin authorization and security helpers', () => {
  it('supports ADMIN and SUPER_ADMIN role checks', () => {
    assert.equal(
      hasAdminRole(
        {
          id: '1',
          email: 'admin@example.com',
          displayName: null,
          role: 'ADMIN',
          mfaEnabled: false,
        },
        ['ADMIN'],
      ),
      true,
    );
    assert.equal(
      hasAdminRole(
        {
          id: '1',
          email: 'admin@example.com',
          displayName: null,
          role: 'ADMIN',
          mfaEnabled: false,
        },
        ['SUPER_ADMIN'],
      ),
      false,
    );
  });

  it('hashes session tokens before storage', () => {
    const hash = hashSessionToken('example-token');
    assert.notEqual(hash, 'example-token');
    assert.equal(hash.length, 64);
  });

  it('detects locked customer accounts', () => {
    assert.equal(isCustomerAccountLocked({ lockedAt: null }), false);
    assert.equal(
      isCustomerAccountLocked({ lockedAt: '2026-09-06T00:00:00.000Z' }),
      true,
    );
  });

  it('uses server-side admin session cookies without exposing secrets in UI', () => {
    const sessionSource = readFileSync(join(import.meta.dirname, 'session.ts'), 'utf8');
    const loginFormSource = readFileSync(
      join(import.meta.dirname, '..', '..', 'components', 'admin', 'admin-login-form.tsx'),
      'utf8',
    );

    assert.match(sessionSource, /HttpOnly/);
    assert.match(sessionSource, /SameSite=Strict/);
    assert.doesNotMatch(loginFormSource, /AWS_/);
    assert.doesNotMatch(loginFormSource, /passwordHash/);
  });

  it('scopes customer lock routes by authenticated admin session', () => {
    const lockRouteSource = readFileSync(
      join(
        import.meta.dirname,
        '..',
        '..',
        'app',
        'api',
        'admin',
        'customers',
        '[userId]',
        'lock',
        'route.ts',
      ),
      'utf8',
    );

    assert.match(lockRouteSource, /requireAdminRole/);
    assert.match(lockRouteSource, /z\.string\(\)\.uuid\(\)/);
    assert.match(lockRouteSource, /writeAdminAuditLog/);
  });
});
