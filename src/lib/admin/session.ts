import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { orm } from '@/lib/db';
import { adminConfig } from '@/lib/admin/config';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie';

export { ADMIN_SESSION_COOKIE };

let pool: Pool | null = null;

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createAdminSession(params: {
  adminUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(
    Date.now() + adminConfig.sessionTtlHours * 60 * 60 * 1000,
  );

  await orm.AdminSession.create({
    id: randomUUID(),
    adminUserId: params.adminUserId,
    tokenHash,
    expiresAt: expiresAt.toISOString(),
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });

  return { token, expiresAt };
}

export async function revokeAdminSession(token: string): Promise<void> {
  const tokenHash = hashSessionToken(token);
  const session = await orm.AdminSession.where({ tokenHash }).first();
  if (!session || session.revokedAt) {
    return;
  }

  await orm.AdminSession.where({ id: session.id }).update({
    revokedAt: new Date().toISOString(),
  });
}

export async function revokeAllAdminSessions(adminUserId: string): Promise<void> {
  await getPool().query(
    `UPDATE "adminSession"
     SET "revokedAt" = NOW()
     WHERE "adminUserId" = $1
       AND "revokedAt" IS NULL`,
    [adminUserId],
  );
}

export type AdminSessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: 'ADMIN' | 'SUPER_ADMIN';
  mfaEnabled: boolean;
};

export async function getAdminSessionUser(
  token: string | null | undefined,
): Promise<AdminSessionUser | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await orm.AdminSession.where({ tokenHash }).first();
  if (!session || session.revokedAt) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const adminUser = await orm.AdminUser.where({ id: session.adminUserId }).first();
  if (!adminUser || adminUser.lockedAt) {
    return null;
  }

  return {
    id: adminUser.id,
    email: adminUser.email,
    displayName: adminUser.displayName,
    role: adminUser.role,
    mfaEnabled: adminUser.mfaEnabled,
  };
}

export function buildAdminSessionCookie(
  token: string,
  expiresAt: Date,
): string {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Expires=${expiresAt.toUTCString()}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildAdminSessionClearCookie(): string {
  const parts = [
    `${ADMIN_SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function readAdminSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === ADMIN_SESSION_COOKIE) {
      return rest.join('=') || null;
    }
  }

  return null;
}
