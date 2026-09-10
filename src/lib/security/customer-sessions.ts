import { createHash, randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';

const SESSION_TTL_DAYS = 30;

export function hashCustomerSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseUserAgent(userAgent: string | null | undefined) {
  const value = userAgent?.trim() ?? '';
  const platform = /iPhone|iPad|iOS/i.test(value)
    ? 'iOS'
    : /Android/i.test(value)
      ? 'Android'
      : /Windows/i.test(value)
        ? 'Windows'
        : /Mac OS|Macintosh/i.test(value)
          ? 'macOS'
          : /Linux/i.test(value)
            ? 'Linux'
            : 'Unknown';
  const browser = /Edg\//i.test(value)
    ? 'Edge'
    : /Chrome\//i.test(value)
      ? 'Chrome'
      : /Safari\//i.test(value) && !/Chrome/i.test(value)
        ? 'Safari'
        : /Firefox\//i.test(value)
          ? 'Firefox'
          : 'Browser';
  return { platform, browser, deviceLabel: `${platform} / ${browser}` };
}

export async function createCustomerSession(params: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ sessionId: string; sessionToken: string; expiresAt: string }> {
  const sessionToken = randomUUID();
  const sessionTokenHash = hashCustomerSessionToken(sessionToken);
  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const parsed = parseUserAgent(params.userAgent);

  await orm.UserSession.create({
    id: sessionId,
    userId: params.userId,
    sessionTokenHash,
    deviceLabel: parsed.deviceLabel,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    lastActiveAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    createdAt: now.toISOString(),
  });

  return { sessionId, sessionToken, expiresAt: expiresAt.toISOString() };
}

export async function listCustomerSessions(userId: string) {
  return orm.UserSession.where({ userId })
    .orderBy((session) => session.lastActiveAt.desc())
    .select('id', 'deviceLabel', 'ipAddress', 'lastActiveAt', 'createdAt', 'revokedAt', 'expiresAt')
    .all();
}

export async function revokeCustomerSession(userId: string, sessionId: string): Promise<boolean> {
  const session = await orm.UserSession.where({ id: sessionId, userId }).first();
  if (!session || session.revokedAt) return false;
  await orm.UserSession.where({ id: sessionId }).update({ revokedAt: new Date().toISOString() });
  return true;
}

export async function revokeOtherCustomerSessions(userId: string, currentSessionId: string): Promise<number> {
  const sessions = await orm.UserSession.where({ userId, revokedAt: null }).select('id').all();
  const now = new Date().toISOString();
  let revoked = 0;
  for (const session of sessions) {
    if (session.id === currentSessionId) continue;
    await orm.UserSession.where({ id: session.id }).update({ revokedAt: now });
    revoked += 1;
  }
  return revoked;
}

export async function isCustomerSessionRevoked(sessionTokenHash: string): Promise<boolean> {
  const session = await orm.UserSession.where({ sessionTokenHash }).select('revokedAt', 'expiresAt').first();
  if (!session) return false;
  if (session.revokedAt) return true;
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) return true;
  return false;
}
