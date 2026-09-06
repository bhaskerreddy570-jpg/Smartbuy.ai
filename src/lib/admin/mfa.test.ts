import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertAdminMfaSatisfied,
  isAdminMfaEnforcementEnabled,
  isAdminMfaRequiredForUser,
  verifyAdminMfa,
} from './mfa';

describe('admin MFA extension point (disabled in current phase)', () => {
  it('does not enforce MFA globally', () => {
    assert.equal(isAdminMfaEnforcementEnabled(), false);
  });

  it('does not require MFA for admin users yet', () => {
    assert.equal(isAdminMfaRequiredForUser({ mfaEnabled: true }), false);
    assert.equal(isAdminMfaRequiredForUser({ mfaEnabled: false }), false);
  });

  it('returns disabled verification results', async () => {
    assert.deepEqual(await verifyAdminMfa({ adminUserId: 'abc', code: '123456' }), {
      status: 'disabled',
    });
    assert.deepEqual(
      await assertAdminMfaSatisfied({
        adminUserId: 'abc',
        mfaEnabled: true,
        code: '123456',
      }),
      { status: 'disabled' },
    );
  });
});
