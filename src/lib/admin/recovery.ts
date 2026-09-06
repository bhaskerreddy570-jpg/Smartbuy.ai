import { createHash, randomBytes } from 'node:crypto';
import { orm } from '@/lib/db';
import { writeAdminAuditLog } from '@/lib/admin/audit';

const RECOVERY_TOKEN_TTL_HOURS = 1;

export function hashRecoveryToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueAdminRecoveryToken(params: {
  targetEmail: string;
  requestedByAdminId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ token: string; expiresAt: Date } | null> {
  const adminUser = await orm.AdminUser.where({
    email: params.targetEmail.toLowerCase(),
  }).first();
  if (!adminUser) {
    return null;
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashRecoveryToken(token);
  const expiresAt = new Date(Date.now() + RECOVERY_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await orm.AdminUser.where({ id: adminUser.id }).update({
    recoveryTokenHash: tokenHash,
    recoveryTokenExpiresAt: expiresAt.toISOString(),
  });

  await writeAdminAuditLog({
    adminUserId: params.requestedByAdminId,
    action: 'RECOVERY_TOKEN_ISSUED',
    targetType: 'adminUser',
    targetId: adminUser.id,
    metadata: { targetEmail: adminUser.email },
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
  const adminUser = await orm.AdminUser.where({
    email: params.email.toLowerCase(),
  }).first();

  if (!adminUser?.recoveryTokenHash || !adminUser.recoveryTokenExpiresAt) {
    await writeAdminAuditLog({
      action: 'RECOVERY_REQUEST_DENIED',
      targetType: 'adminUser',
      metadata: { email: params.email.toLowerCase(), reason: 'no_active_token' },
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
  if (tokenHash !== adminUser.recoveryTokenHash) {
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

  await orm.AdminUser.where({ id: adminUser.id }).update({
    passwordHash: params.newPasswordHash,
    recoveryTokenHash: null,
    recoveryTokenExpiresAt: null,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lockedAt: null,
    lockReason: null,
  });

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
