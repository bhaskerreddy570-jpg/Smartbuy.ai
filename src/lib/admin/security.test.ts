import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { isAdminUser } from './authorization';
import { hashSessionToken } from './session';
import { isCustomerAccountLocked } from './customer-accounts';

const adminApiRoot = join(import.meta.dirname, '..', '..', 'app', 'api', 'admin');
const adminLibRoot = join(import.meta.dirname);

describe('admin authorization and security helpers', () => {
  it('supports only ADMIN role authorization', () => {
    assert.equal(
      isAdminUser({
        id: '1',
        email: 'admin@example.com',
        displayName: null,
        role: 'ADMIN',
        mfaEnabled: false,
      }),
      true,
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
    assert.match(sessionSource, /Expires=/);
    assert.match(sessionSource, /revokeAllAdminSessions/);
    assert.doesNotMatch(loginFormSource, /AWS_/);
    assert.doesNotMatch(loginFormSource, /passwordHash/);
  });

  it('scopes customer lock routes by authenticated admin session', () => {
    const lockRouteSource = readFileSync(
      join(adminApiRoot, 'customers', '[userId]', 'lock', 'route.ts'),
      'utf8',
    );

    assert.match(lockRouteSource, /requireAdminRole/);
    assert.match(lockRouteSource, /z\.string\(\)\.uuid\(\)/);
    assert.match(lockRouteSource, /writeAdminAuditLog/);
  });

  it('requires authenticated ADMIN for recovery initiation', () => {
    const initiateSource = readFileSync(
      join(adminApiRoot, 'recovery', 'initiate', 'route.ts'),
      'utf8',
    );

    assert.match(initiateSource, /requireAdminSession/);
    assert.doesNotMatch(initiateSource, /SUPER_ADMIN/);
  });

  it('keeps backup and data-recovery hooks authorization-protected', () => {
    const backupSource = readFileSync(
      join(adminApiRoot, 'operations', 'backup', 'route.ts'),
      'utf8',
    );
    const dataRecoverySource = readFileSync(
      join(adminApiRoot, 'operations', 'data-recovery', 'route.ts'),
      'utf8',
    );

    assert.match(backupSource, /requireAdminRole/);
    assert.match(backupSource, /requestBackupRecovery/);
    assert.match(dataRecoverySource, /requireAdminRole/);
    assert.match(dataRecoverySource, /requestBackupRecovery/);
    assert.doesNotMatch(backupSource, /createDownloadUrl|AWS_/);
    assert.doesNotMatch(dataRecoverySource, /createDownloadUrl|AWS_/);
  });

  it('does not expose admin APIs through customer auth helpers', () => {
    const authHelperSource = readFileSync(
      join(import.meta.dirname, '..', 'api', 'auth.ts'),
      'utf8',
    );

    assert.doesNotMatch(authHelperSource, /AdminUser|adminSession|SUPER_ADMIN/);
  });

  it('sanitizes audit logs before persistence', () => {
    const auditSource = readFileSync(join(import.meta.dirname, 'audit.ts'), 'utf8');

    assert.match(auditSource, /sanitizeAuditMetadata/);
  });

  it('rotates admin sessions on successful login to reduce fixation risk', () => {
    const loginSource = readFileSync(join(import.meta.dirname, 'login.ts'), 'utf8');

    assert.match(loginSource, /revokeAllAdminSessions/);
    assert.match(loginSource, /createAdminSession/);
  });

  it('does not retain SUPER_ADMIN authorization anywhere in admin lib', () => {
    const files = [
      'authorization.ts',
      'login.ts',
      'session.ts',
      'bootstrap.ts',
      'change-password.ts',
      'recovery.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(adminLibRoot, file), 'utf8');
      assert.doesNotMatch(source, /SUPER_ADMIN/);
    }
  });

  it('requires current password for authenticated password changes', () => {
    const changePasswordRoute = readFileSync(
      join(adminApiRoot, 'auth', 'change-password', 'route.ts'),
      'utf8',
    );
    const changePasswordLib = readFileSync(
      join(adminLibRoot, 'change-password.ts'),
      'utf8',
    );

    assert.match(changePasswordRoute, /currentPassword/);
    assert.match(changePasswordRoute, /confirmPassword/);
    assert.match(changePasswordRoute, /requireAdminSession/);
    assert.match(changePasswordLib, /verifyAdminPassword/);
    assert.match(changePasswordLib, /revokeAllAdminSessions/);
    assert.match(changePasswordLib, /ADMIN_PASSWORD_CHANGED/);
  });
});
