import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';
import { ensureContactBackupSettings } from '@/lib/contacts/sync-service';
import { registerOrRefreshDevice } from '@/lib/mobile/device-auth';

const PAIRING_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const PORTAL_IMPORT_DEVICE_NAME = 'CloudStoreNow Portal Import';

export function isPortalImportDevice(displayName: string): boolean {
  return displayName === PORTAL_IMPORT_DEVICE_NAME;
}

function hashPairingCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generatePairingCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[bytes[index]! % CODE_ALPHABET.length];
  }
  return code;
}

export type PairingSessionStatus = 'pending' | 'completed' | 'expired';

export type PairingSessionView = {
  sessionId: string;
  pairingCode: string;
  expiresAt: string;
  qrPayload: {
    type: 'cloudstorenow.pair';
    version: 1;
    sessionId: string;
    code: string;
  };
};

export type PairingSessionPoll = {
  status: PairingSessionStatus;
  expiresAt: string;
  device?: {
    id: string;
    displayName: string;
    platform: 'ANDROID' | 'IOS';
    automaticBackupEnabled: boolean;
    lastSyncAt: string | null;
    createdAt: string;
  };
};

export async function createDevicePairingSession(userId: string): Promise<PairingSessionView> {
  const now = Date.now();
  const expiresAt = new Date(now + PAIRING_TTL_MS).toISOString();
  const pairingCode = generatePairingCode();
  const sessionId = randomUUID();

  await orm.DevicePairingSession.create({
    id: sessionId,
    userId,
    codeHash: hashPairingCode(pairingCode),
    expiresAt,
    createdAt: new Date(now).toISOString(),
  });

  return {
    sessionId,
    pairingCode,
    expiresAt,
    qrPayload: {
      type: 'cloudstorenow.pair',
      version: 1,
      sessionId,
      code: pairingCode,
    },
  };
}

async function loadOwnedPairingSession(userId: string, sessionId: string) {
  return orm.DevicePairingSession.where({ id: sessionId, userId }).first();
}

export async function getDevicePairingSessionStatus(
  userId: string,
  sessionId: string,
): Promise<PairingSessionPoll | null> {
  const session = await loadOwnedPairingSession(userId, sessionId);
  if (!session) {
    return null;
  }

  const now = Date.now();
  if (session.consumedAt && session.deviceId) {
    const device = await orm.CustomerDevice.where({ id: session.deviceId, userId })
      .select(
        'id',
        'displayName',
        'platform',
        'automaticBackupEnabled',
        'lastSyncAt',
        'createdAt',
      )
      .first();

    if (device) {
      return {
        status: 'completed',
        expiresAt: session.expiresAt,
        device: {
          id: device.id,
          displayName: device.displayName,
          platform: device.platform as 'ANDROID' | 'IOS',
          automaticBackupEnabled: device.automaticBackupEnabled,
          lastSyncAt: device.lastSyncAt,
          createdAt: device.createdAt,
        },
      };
    }
  }

  if (new Date(session.expiresAt).getTime() <= now) {
    return {
      status: 'expired',
      expiresAt: session.expiresAt,
    };
  }

  if (session.consumedAt) {
    return {
      status: 'completed',
      expiresAt: session.expiresAt,
    };
  }

  return {
    status: 'pending',
    expiresAt: session.expiresAt,
  };
}

export async function completeDevicePairing(params: {
  userId: string;
  sessionId?: string;
  pairingCode: string;
  platform: 'ANDROID' | 'IOS';
  appVersion?: string;
  displayName?: string;
  installationId?: string;
}): Promise<{
  deviceId: string;
  token: string;
  expiresAt: string;
}> {
  const normalizedCode = params.pairingCode.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error('INVALID_PAIRING_CODE');
  }

  const codeHash = hashPairingCode(normalizedCode);
  let session = params.sessionId
    ? await orm.DevicePairingSession.where({
        id: params.sessionId,
        userId: params.userId,
      }).first()
    : null;

  if (!session) {
    session = await orm.DevicePairingSession.where({
      userId: params.userId,
      codeHash,
    }).first();
  }

  if (!session) {
    throw new Error('PAIRING_SESSION_NOT_FOUND');
  }

  if (session.codeHash !== codeHash) {
    throw new Error('INVALID_PAIRING_CODE');
  }

  if (session.consumedAt) {
    throw new Error('PAIRING_SESSION_CONSUMED');
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new Error('PAIRING_SESSION_EXPIRED');
  }

  await ensureContactBackupSettings(params.userId);

  const registration = await registerOrRefreshDevice({
    userId: params.userId,
    platform: params.platform,
    appVersion: params.appVersion,
    displayName: params.displayName,
    deviceId: params.installationId,
  });

  const consumedAt = new Date().toISOString();
  await orm.DevicePairingSession.where({ id: session.id }).update({
    consumedAt,
    deviceId: registration.deviceId,
  });

  return registration;
}
