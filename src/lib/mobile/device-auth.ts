import { createHash, randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { orm } from '@/lib/db';

const TOKEN_TTL_DAYS = 90;

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

export const mobileLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  platform: z.enum(['ANDROID', 'IOS']),
  appVersion: z.string().max(64).optional(),
  displayName: z.string().max(120).optional(),
});

export async function authenticateMobileCustomer(params: {
  email: string;
  password: string;
}): Promise<{ userId: string; email: string; name: string | null } | null> {
  const user = await orm.User.where({ email: params.email.toLowerCase() })
    .select('id', 'email', 'name', 'passwordHash', 'lockedAt')
    .first();

  if (!user || user.lockedAt) {
    return null;
  }

  const valid = await bcrypt.compare(params.password, user.passwordHash);
  if (!valid) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}

export async function registerOrRefreshDevice(params: {
  userId: string;
  platform: 'ANDROID' | 'IOS';
  appVersion?: string;
  displayName?: string;
  deviceId?: string;
}): Promise<{
  deviceId: string;
  token: string;
  expiresAt: string;
}> {
  const now = new Date().toISOString();
  const defaultName =
    params.displayName?.trim() ||
    (params.platform === 'ANDROID' ? 'CloudStoreNow Android' : 'CloudStoreNow iPhone');

  let deviceId = params.deviceId;
  if (deviceId) {
    const existing = await orm.CustomerDevice.where({
      id: deviceId,
      userId: params.userId,
    }).first();
    if (!existing || existing.revokedAt) {
      deviceId = undefined;
    }
  }

  if (!deviceId) {
    deviceId = randomUUID();
    await orm.CustomerDevice.create({
      id: deviceId,
      userId: params.userId,
      platform: params.platform,
      displayName: defaultName,
      appVersion: params.appVersion ?? null,
      automaticBackupEnabled: true,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await orm.CustomerDevice.where({ id: deviceId }).update({
      appVersion: params.appVersion ?? null,
      displayName: defaultName,
      lastSeenAt: now,
      updatedAt: now,
    });
  }

  const token = generateDeviceToken();
  const tokenHash = hashDeviceToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  await orm.CustomerDeviceToken.create({
    id: randomUUID(),
    deviceId,
    tokenHash,
    expiresAt,
    createdAt: now,
  });

  return { deviceId, token, expiresAt };
}

export type AuthenticatedMobileContext = {
  userId: string;
  deviceId: string;
  platform: 'ANDROID' | 'IOS';
};

export async function resolveMobileAuth(
  authorizationHeader: string | null,
): Promise<AuthenticatedMobileContext | null> {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  const tokenHash = hashDeviceToken(token);
  const session = await orm.CustomerDeviceToken.where({ tokenHash })
    .select('id', 'deviceId', 'expiresAt', 'revokedAt')
    .first();

  if (!session || session.revokedAt) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const device = await orm.CustomerDevice.where({ id: session.deviceId })
    .select('id', 'userId', 'platform', 'revokedAt')
    .first();

  if (!device || device.revokedAt) {
    return null;
  }

  await orm.CustomerDevice.where({ id: device.id }).update({
    lastSeenAt: new Date().toISOString(),
  });

  return {
    userId: device.userId,
    deviceId: device.id,
    platform: device.platform as 'ANDROID' | 'IOS',
  };
}

export async function revokeCustomerDevice(userId: string, deviceId: string): Promise<boolean> {
  const device = await orm.CustomerDevice.where({ id: deviceId, userId }).first();
  if (!device || device.revokedAt) {
    return false;
  }

  const now = new Date().toISOString();
  await orm.CustomerDevice.where({ id: deviceId }).update({
    revokedAt: now,
    updatedAt: now,
  });

  await orm.CustomerDeviceToken.where({ deviceId }).update({
    revokedAt: now,
  });

  return true;
}
