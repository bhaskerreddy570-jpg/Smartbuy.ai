import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { after, describe, it } from 'node:test';
import { orm } from '@/lib/db';
import { createDefaultCustomerLimits } from '@/lib/customer-limits';
import {
  completeDevicePairing,
  createDevicePairingSession,
  getDevicePairingSessionStatus,
} from '@/lib/mobile/device-pairing';
import { resolveMobileAuth, revokeCustomerDevice } from '@/lib/mobile/device-auth';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

describeIntegration('device pairing integration', () => {
  let userId = '';
  let otherUserId = '';
  let deviceId = '';
  let deviceToken = '';

  after(async () => {
    if (userId) {
      await orm.DevicePairingSession.where({ userId }).delete();
      await orm.CustomerDeviceToken.where({ deviceId }).delete();
      await orm.CustomerDevice.where({ userId }).delete();
      await orm.User.where({ id: userId }).delete();
    }
    if (otherUserId) {
      await orm.DevicePairingSession.where({ userId: otherUserId }).delete();
      await orm.CustomerDevice.where({ userId: otherUserId }).delete();
      await orm.User.where({ id: otherUserId }).delete();
    }
  });

  it('pairs a mobile device to the authenticated web customer only', async () => {
    const password = 'PairingTest123!';
    const passwordHash = await bcrypt.hash(password, 12);
    const defaults = createDefaultCustomerLimits();

    const user = await orm.User.create({
      email: `pairing-${randomUUID()}@example.com`,
      name: 'Pairing Test',
      passwordHash,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });
    userId = user.id;

    const otherUser = await orm.User.create({
      email: `pairing-other-${randomUUID()}@example.com`,
      name: 'Other User',
      passwordHash,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });
    otherUserId = otherUser.id;

    const session = await createDevicePairingSession(userId);
    assert.equal((await getDevicePairingSessionStatus(userId, session.sessionId))?.status, 'pending');

    await assert.rejects(
      () =>
        completeDevicePairing({
          userId: otherUserId,
          pairingCode: session.pairingCode,
          platform: 'ANDROID',
        }),
      /PAIRING_SESSION_NOT_FOUND/,
    );

    const registration = await completeDevicePairing({
      userId,
      pairingCode: session.pairingCode,
      platform: 'ANDROID',
      displayName: 'Paired Android',
    });

    deviceId = registration.deviceId;
    deviceToken = registration.token;

    const completed = await getDevicePairingSessionStatus(userId, session.sessionId);
    assert.equal(completed?.status, 'completed');
    assert.equal(completed?.device?.displayName, 'Paired Android');

    await assert.rejects(
      () =>
        completeDevicePairing({
          userId,
          pairingCode: session.pairingCode,
          platform: 'ANDROID',
        }),
      /PAIRING_SESSION_CONSUMED/,
    );

    const auth = await resolveMobileAuth(`Bearer ${deviceToken}`);
    assert.ok(auth);
    assert.equal(auth?.userId, userId);

    const revoked = await revokeCustomerDevice(userId, deviceId);
    assert.equal(revoked, true);

    const authAfterRevoke = await resolveMobileAuth(`Bearer ${deviceToken}`);
    assert.equal(authAfterRevoke, null);
  });
});
