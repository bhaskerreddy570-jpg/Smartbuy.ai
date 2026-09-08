import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { describe, it } from 'node:test';
import { orm } from '@/lib/db';
import { createDefaultCustomerLimits } from '@/lib/customer-limits';
import {
  consolidateSingleApplicationAdmin,
  countAdminUsers,
  ensureApplicationAdminProvisioned,
  provisionInitialAdmin,
  resolveDesignatedAdminEmail,
  resolvePortalUserRole,
} from '@/lib/admin/bootstrap';
import { hashAdminPassword } from '@/lib/admin/password';

describe('admin bootstrap and portal role resolution', () => {
  it('creates the designated admin and removes any other admin accounts', async () => {
    const designatedEmail = `designated-${randomUUID()}@example.com`;
    const otherEmail = `other-${randomUUID()}@example.com`;
    const otherPasswordHash = await hashAdminPassword('OtherAdminPassword123!');

    const otherAdmin = await orm.AdminUser.create({
      email: otherEmail,
      passwordHash: otherPasswordHash,
      role: 'ADMIN',
      mfaEnabled: false,
    });

    process.env.ADMIN_INITIAL_EMAIL = designatedEmail;
    process.env.ADMIN_INITIAL_PASSWORD = 'DesignatedAdmin123!';

    const created = await provisionInitialAdmin();
    assert.equal(created.status, 'created');
    assert.equal(created.email, designatedEmail.toLowerCase());
    assert.ok(created.removedOtherAdmins >= 1);

    const admins = await orm.AdminUser.select('email', 'role').all();
    assert.equal(admins.length, 1);
    assert.equal(admins[0]?.email, designatedEmail.toLowerCase());
    assert.equal(admins[0]?.role, 'ADMIN');
    assert.equal(await orm.AdminUser.where({ id: otherAdmin.id }).first(), null);
    assert.equal(await countAdminUsers(), 1);

    await orm.AdminUser.where({ email: designatedEmail.toLowerCase() }).delete();
  });

  it('shows ADMIN in the customer portal only when a matching AdminUser exists', async () => {
    const email = `portal-role-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const passwordHash = await bcrypt.hash('PortalRoleTest123!', 12);

    const user = await orm.User.create({
      email,
      name: 'Portal Role Test',
      passwordHash,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });

    try {
      assert.equal(await resolvePortalUserRole(email), 'USER');

      await orm.AdminUser.create({
        email,
        passwordHash: await hashAdminPassword('PortalAdminPassword123!'),
        role: 'ADMIN',
        mfaEnabled: false,
      });

      assert.equal(await resolvePortalUserRole(email), 'ADMIN');
    } finally {
      await orm.AdminUser.where({ email: email.toLowerCase() }).delete();
      await orm.User.where({ id: user.id }).delete();
    }
  });

  it('links the designated customer account to AdminUser when env password is absent', async () => {
    const designatedEmail = `designated-link-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const passwordHash = await bcrypt.hash('DesignatedLinkTest123!', 12);
    const originalEmail = process.env.ADMIN_INITIAL_EMAIL;
    const originalPassword = process.env.ADMIN_INITIAL_PASSWORD;

    process.env.ADMIN_INITIAL_EMAIL = designatedEmail;
    delete process.env.ADMIN_INITIAL_PASSWORD;

    const user = await orm.User.create({
      email: designatedEmail,
      name: 'Designated Link Test',
      passwordHash,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });

    try {
      assert.equal(await resolvePortalUserRole(designatedEmail), 'USER');

      const linked = await ensureApplicationAdminProvisioned();
      assert.equal(linked.status, 'linked_from_customer');
      assert.equal(linked.email, designatedEmail.toLowerCase());
      assert.equal(await resolvePortalUserRole(designatedEmail), 'ADMIN');
      assert.equal(await countAdminUsers(), 1);
    } finally {
      await orm.AdminUser.where({ email: designatedEmail.toLowerCase() }).delete();
      await orm.User.where({ id: user.id }).delete();
      if (originalEmail === undefined) {
        delete process.env.ADMIN_INITIAL_EMAIL;
      } else {
        process.env.ADMIN_INITIAL_EMAIL = originalEmail;
      }
      if (originalPassword === undefined) {
        delete process.env.ADMIN_INITIAL_PASSWORD;
      } else {
        process.env.ADMIN_INITIAL_PASSWORD = originalPassword;
      }
    }
  });

  it('does not link arbitrary customer emails without env override', async () => {
    const email = `not-designated-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const originalEmail = process.env.ADMIN_INITIAL_EMAIL;
    const originalPassword = process.env.ADMIN_INITIAL_PASSWORD;

    delete process.env.ADMIN_INITIAL_EMAIL;
    delete process.env.ADMIN_INITIAL_PASSWORD;

    const user = await orm.User.create({
      email,
      name: 'Not Designated',
      passwordHash: await bcrypt.hash('NotDesignatedTest123!', 12),
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });

    try {
      const result = await ensureApplicationAdminProvisioned();
      assert.equal(result.status, 'customer_missing');
      assert.equal(result.email, resolveDesignatedAdminEmail());
      assert.equal(await resolvePortalUserRole(email), 'USER');
      assert.equal(await orm.AdminUser.where({ email }).first(), null);
    } finally {
      await orm.User.where({ id: user.id }).delete();
      if (originalEmail === undefined) {
        delete process.env.ADMIN_INITIAL_EMAIL;
      } else {
        process.env.ADMIN_INITIAL_EMAIL = originalEmail;
      }
      if (originalPassword === undefined) {
        delete process.env.ADMIN_INITIAL_PASSWORD;
      } else {
        process.env.ADMIN_INITIAL_PASSWORD = originalPassword;
      }
    }
  });

  it('keeps consolidateSingleApplicationAdmin idempotent for the designated email', async () => {
    const email = `consolidate-${randomUUID()}@example.com`;

    const admin = await orm.AdminUser.create({
      email,
      passwordHash: await hashAdminPassword('ConsolidateAdmin123!'),
      role: 'ADMIN',
      mfaEnabled: false,
      lockedAt: new Date().toISOString(),
      lockReason: 'test lock',
      failedLoginAttempts: 3,
    });

    try {
      const removed = await consolidateSingleApplicationAdmin(email);
      assert.ok(removed >= 0);

      const stored = await orm.AdminUser.where({ email: email.toLowerCase() }).first();
      assert.ok(stored);
      assert.equal(stored.role, 'ADMIN');
      assert.equal(stored.lockedAt, null);
      assert.equal(stored.failedLoginAttempts, 0);
      assert.equal(await countAdminUsers(), 1);
    } finally {
      await orm.AdminUser.where({ id: admin.id }).delete();
    }
  });
});
