import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { after, describe, it } from 'node:test';
import { orm } from '@/lib/db';
import { createDefaultCustomerLimits } from '@/lib/customer-limits';
import { normalizeContactPayload } from '@/lib/contacts/payload';
import {
  applyDeviceContactSync,
  getContactBackupSummary,
  importContactsForUser,
} from '@/lib/contacts/sync-service';
import { registerOrRefreshDevice } from '@/lib/mobile/device-auth';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

describeIntegration('contacts backup integration', () => {
  let userId = '';
  let deviceId = '';

  after(async () => {
    if (!userId) {
      return;
    }

    await orm.DeviceContactMapping.where({ deviceId }).delete();
    await orm.CloudContact.where({ userId }).delete();
    await orm.ContactBackupSettings.where({ userId }).delete();
    await orm.CustomerDeviceToken.where({ deviceId }).delete();
    await orm.CustomerDevice.where({ userId }).delete();
    await orm.User.where({ id: userId }).delete();
  });

  it('syncs incremental contacts for the authenticated device only', async () => {
    const email = `contacts-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const passwordHash = await bcrypt.hash('ContactsTest123!', 12);

    const user = await orm.User.create({
      email,
      name: 'Contacts Test',
      passwordHash,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });

    userId = user.id;
    const session = await registerOrRefreshDevice({
      userId,
      platform: 'ANDROID',
      appVersion: '1.0.0-test',
    });
    deviceId = session.deviceId;

    const payload = normalizeContactPayload({
      givenName: 'Sync',
      familyName: 'Tester',
      phones: [{ value: '555-0100' }],
      emails: [{ value: 'sync@example.com' }],
      addresses: [],
    });

    const first = await applyDeviceContactSync({
      userId,
      deviceId,
      sinceCursor: BigInt(0),
      force: true,
      changes: [
        {
          localContactId: 'local-1',
          operation: 'upsert',
          payload,
          localModifiedAt: new Date().toISOString(),
        },
      ],
    });

    assert.equal(first.applied, 1);

    const summary = await getContactBackupSummary(userId);
    assert.equal(summary.contactCount, 1);
    assert.equal(summary.automaticBackupEnabled, true);

    const second = await applyDeviceContactSync({
      userId,
      deviceId,
      sinceCursor: BigInt(summary.syncCursor),
      force: true,
      changes: [
        {
          localContactId: 'local-1',
          operation: 'upsert',
          payload,
          localModifiedAt: new Date().toISOString(),
          lastKnownCloudVersion: summary.syncCursor,
        },
      ],
    });

    assert.equal(second.applied, 1);

    const imported = await importContactsForUser({
      userId,
      changes: [
        {
          localContactId: 'portal-import-1',
          operation: 'upsert',
          payload: normalizeContactPayload({
            givenName: 'Portal',
            familyName: 'Import',
            phones: [{ value: '555-0200' }],
            emails: [],
            addresses: [],
          }),
        },
      ],
    });

    assert.equal(imported.applied, 1);
    const finalSummary = await getContactBackupSummary(userId);
    assert.equal(finalSummary.contactCount, 2);
  });
});
