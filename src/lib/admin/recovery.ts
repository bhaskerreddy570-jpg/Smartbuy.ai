import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { orm } from '@/lib/db';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { adminConfig } from '@/lib/admin/config';
import { getRecoveryTokenTtlMs } from '@/lib/admin/recovery-handoff';
import { revokeAllAdminSessions } from '@/lib/admin/session';

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

export function hashRecoveryToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function recoveryTokensMatch(expectedHash: string, providedHash: string): boolean {
  const expected = Buffer.from(expectedHash, 'hex');
  const provided = Buffer.from(providedHash, 'hex');

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

export async function isRecoveryInitiateRateLimited(params: {
  adminUserId: string;
}): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - adminConfig.recoveryRateLimitWindowMinutes * 60 * 1000,
  ).toISOString();

  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM "adminAuditLog"
     WHERE action = 'RECOVERY_TOKEN_ISSUED'
       AND "adminUserId" = $1
       AND "createdAt" >= $2`,
    [params.adminUserId, windowStart],
  );

  return Number(result.rows[0]?.count ?? 0) >= adminConfig.recoveryInitiateRateLimitMax;
}

export async function isRecoveryCompleteRateLimited(params: {
  ipAddress: string;
}): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - adminConfig.recoveryRateLimitWindowMinutes * 60 * 1000,
  ).toISOString();

  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM "adminAuditLog"
     WHERE action = 'RECOVERY_REQUEST_DENIED'
       AND "createdAt" >= $1
       AND "ipAddress" = $2`,
    [windowStart, params.ipAddress],
  );

  return Number(result.rows[0]?.count ?? 0) >= adminConfig.recoveryCompleteRateLimitMax;
}

export async function issueAdminRecoveryToken(params: {
  targetEmail: string;
  requestedByAdminId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date } | null> {
  if (await isRecoveryInitiateRateLimited({ adminUserId: params.requestedByAdminId })) {
    await writeAdminAuditLog({
      adminUserId: params.requestedByAdminId,
      action: 'RECOVERY_REQUEST_DENIED',
      targetType: 'adminUser',
      metadata: { reason: 'initiate_rate_limited' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return null;
  }

  const adminUser = await orm.AdminUser.where({
    email: params.targetEmail.toLowerCase(),
  }).first();
  if (!adminUser) {
    return null;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashRecoveryToken(token);
  const expiresAt = new Date(Date.now() + getRecoveryTokenTtlMs());

  await orm.AdminUser.where({ id: adminUser.id }).update({
    recoveryTokenHash: tokenHash,
    recoveryTokenExpiresAt: expiresAt.toISOString(),
  });

  await writeAdminAuditLog({
    adminUserId: params.requestedByAdminId,
    action: 'RECOVERY_TOKEN_ISSUED',
    targetType: 'adminUser',
    targetId: adminUser.id,
    metadata: { reason: 'break_glass_recovery' },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return { token, expiresAt };
}

export async function completeAdminRecovery(params: {
  email: string;
  token: string;
  newPasswordHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<'ok' | 'invalid' | 'denied'> {
  const normalizedEmail = params.email.toLowerCase();

  if (
    await isRecoveryCompleteRateLimited({
      ipAddress: params.ipAddress ?? 'unknown',
    })
  ) {
    await writeAdminAuditLog({
      action: 'RECOVERY_REQUEST_DENIED',
      targetType: 'adminUser',
      metadata: { reason: 'complete_rate_limited' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return 'denied';
  }

  const adminUser = await orm.AdminUser.where({ email: normalizedEmail }).first();
  if (!adminUser?.recoveryTokenHash || !adminUser.recoveryTokenExpiresAt) {
    await writeAdminAuditLog({
      action: 'RECOVERY_REQUEST_DENIED',
      targetType: 'adminUser',
      targetId: adminUser?.id,
      metadata: { reason: 'no_active_token' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return 'invalid';
  }

  if (new Date(adminUser.recoveryTokenExpiresAt).getTime() <= Date.now()) {
    await writeAdminAuditLog({
      adminUserId: adminUser.id,
      action: 'RECOVERY_REQUEST_DENIED',
      targetType: 'adminUser',
      targetId: adminUser.id,
      metadata: { reason: 'expired_token' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return 'invalid';
  }

  const tokenHash = hashRecoveryToken(params.token);
  if (!recoveryTokensMatch(adminUser.recoveryTokenHash, tokenHash)) {
    await writeAdminAuditLog({
      adminUserId: adminUser.id,
      action: 'RECOVERY_REQUEST_DENIED',
      targetType: 'adminUser',
      targetId: adminUser.id,
      metadata: { reason: 'token_mismatch' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return 'invalid';
  }

  const updated = await getPool().query<{ id: string }>(
    `UPDATE "adminUser"
     SET "passwordHash" = $1,
         "recoveryTokenHash" = NULL,
         "recoveryTokenExpiresAt" = NULL,
         "failedLoginAttempts" = 0,
         "lastFailedLoginAt" = NULL,
         "lockedAt" = NULL,
         "lockReason" = NULL,
         "updatedAt" = NOW()
     WHERE id = $2
       AND email = $3
       AND "recoveryTokenHash" = $4
       AND "recoveryTokenExpiresAt" > NOW()
     RETURNING id`,
    [params.newPasswordHash, adminUser.id, normalizedEmail, adminUser.recoveryTokenHash],
  );

  if (updated.rowCount !== 1) {
    await writeAdminAuditLog({
      adminUserId: adminUser.id,
      action: 'RECOVERY_REQUEST_DENIED',
      targetType: 'adminUser',
      targetId: adminUser.id,
      metadata: { reason: 'token_already_used_or_expired' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return 'invalid';
  }

  await revokeAllAdminSessions(adminUser.id);

  await writeAdminAuditLog({
    adminUserId: adminUser.id,
    action: 'RECOVERY_TOKEN_USED',
    targetType: 'adminUser',
    targetId: adminUser.id,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return 'ok';
}

export async function requestBackupRecovery(params: {
  adminUserId: string;
  requestType: 'BACKUP_REQUESTED' | 'DATA_RECOVERY_REQUESTED';
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await writeAdminAuditLog({
    adminUserId: params.adminUserId,
    action: params.requestType,
    metadata: params.metadata,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
}
