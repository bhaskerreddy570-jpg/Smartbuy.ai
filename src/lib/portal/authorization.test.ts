import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const projectRoot = join(import.meta.dirname, '..', '..');
const adminApiRoot = join(projectRoot, 'app', 'api', 'admin');
const customerApiRoot = join(projectRoot, 'app', 'api', 'customer');
const portalRoot = join(projectRoot, 'app', '(portal)');

describe('portal and role separation', () => {
  it('protects customer portal layout with server-side auth', () => {
    const layoutSource = readFileSync(join(portalRoot, 'layout.tsx'), 'utf8');
    assert.match(layoutSource, /await auth\(\)/);
    assert.match(layoutSource, /redirect\("\/login"\)/);
    assert.match(layoutSource, /getPortalContext/);
  });

  it('protects admin console layout with server-side admin session', () => {
    const layoutSource = readFileSync(
      join(projectRoot, 'app', 'admin', '(console)', 'layout.tsx'),
      'utf8',
    );
    assert.match(layoutSource, /getAdminSessionUser/);
    assert.match(layoutSource, /isAdminUser/);
    assert.match(layoutSource, /redirect\("\/admin\/login"\)/);
  });

  it('requires authenticated customer for profile API', () => {
    const profileRoute = readFileSync(
      join(customerApiRoot, 'profile', 'route.ts'),
      'utf8',
    );
    assert.match(profileRoute, /requireAuthUser/);
    assert.doesNotMatch(profileRoute, /requireAdminSession/);
  });

  it('requires authenticated customer for password change API', () => {
    const passwordRoute = readFileSync(
      join(customerApiRoot, 'change-password', 'route.ts'),
      'utf8',
    );
    assert.match(passwordRoute, /requireAuthUser/);
    assert.doesNotMatch(passwordRoute, /AdminUser|requireAdminSession/);
  });

  it('keeps admin customer APIs protected from customer auth helpers', () => {
    const customersRoute = readFileSync(
      join(adminApiRoot, 'customers', 'route.ts'),
      'utf8',
    );
    assert.match(customersRoute, /requireAdminSession|requireAdminRole/);
    assert.doesNotMatch(customersRoute, /requireAuthUser/);
  });

  it('does not expose role editing in customer profile API', () => {
    const profileRoute = readFileSync(
      join(customerApiRoot, 'profile', 'route.ts'),
      'utf8',
    );
    assert.doesNotMatch(profileRoute, /\brole\b/);
    assert.match(profileRoute, /name/);
  });

  it('derives portal role from AdminUser records without customer self-promotion', () => {
    const portalDataSource = readFileSync(
      join(projectRoot, 'lib', 'portal', 'data.ts'),
      'utf8',
    );
    assert.match(portalDataSource, /resolvePortalUserRole/);
    assert.doesNotMatch(portalDataSource, /role:\s*'USER'/);
  });

  it('shows admin portal entry only through server-provided admin session flag', () => {
    const shellSource = readFileSync(
      join(projectRoot, 'components', 'portal', 'portal-shell.tsx'),
      'utf8',
    );
    assert.match(shellSource, /hasAdminSession/);
    assert.doesNotMatch(shellSource, /bhaskerreddy600@gmail.com/);
  });

  it('persists invalid zero quotas through server-side backfill helper', () => {
    const backfillSource = readFileSync(
      join(projectRoot, 'lib', 'quota-backfill.ts'),
      'utf8',
    );
    assert.match(backfillSource, /normalizeStorageQuota/);
    assert.match(backfillSource, /BigInt\(user\.storageQuota\) <= 0n/);
  });
});
