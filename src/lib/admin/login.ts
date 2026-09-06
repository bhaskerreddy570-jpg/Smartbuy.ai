import { randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { adminConfig } from '@/lib/admin/config';
import { assertAdminMfaSatisfied } from '@/lib/admin/mfa';
import { verifyAdminPassword } from '@/lib/admin/password';
import {
  isAdminLoginRateLimited,
  recordAdminLoginAttempt,
} from '@/lib/admin/rate-limit';
import {
  buildAdminSessionCookie,
  createAdminSession,
} from '@/lib/admin/session';

export type AdminLoginResult =
  | {
      ok: true;
      sessionToken: string;
      cookie: string;
      admin: { id: string; email: string; role: 'ADMIN' | 'SUPER_ADMIN' };
    }
  | {
      ok: false;
      reason:
        | 'rate_limited'
        | 'invalid_credentials'
        | 'locked'
        | 'mfa_failed';
    };

export async function authenticateAdminLogin(params: {
  email: string;
  password: string;
  ipAddress: string;
  userAgent?: string | null;
  mfaCode?: string;
}): Promise<AdminLoginResult> {
  const normalizedEmail = params.email.toLowerCase().trim();

  if (await isAdminLoginRateLimited({ email: normalizedEmail, ipAddress: params.ipAddress })) {
    await writeAdminAuditLog({
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'adminUser',
      metadata: { email: normalizedEmail, reason: 'rate_limited' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    await recordAdminLoginAttempt({
      email: normalizedEmail,
      ipAddress: params.ipAddress,
      success: false,
    });
    return { ok: false, reason: 'rate_limited' };
  }

  const adminUser = await orm.AdminUser.where({ email: normalizedEmail }).first();

  if (!adminUser || !(await verifyAdminPassword(params.password, adminUser.passwordHash))) {
    if (adminUser) {
      const failedAttempts = adminUser.failedLoginAttempts + 1;
      const updates: Record<string, unknown> = {
        failedLoginAttempts: failedAttempts,
        lastFailedLoginAt: new Date().toISOString(),
      };

      if (failedAttempts >= adminConfig.accountLockThreshold) {
        updates.lockedAt = new Date().toISOString();
        updates.lockReason = 'Too many failed login attempts';
      }

      await orm.AdminUser.where({ id: adminUser.id }).update(updates);
    }

    await writeAdminAuditLog({
      adminUserId: adminUser?.id ?? null,
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'adminUser',
      targetId: adminUser?.id,
      metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    await recordAdminLoginAttempt({
      email: normalizedEmail,
      ipAddress: params.ipAddress,
      success: false,
    });
    return { ok: false, reason: 'invalid_credentials' };
  }

  if (adminUser.lockedAt) {
    await writeAdminAuditLog({
      adminUserId: adminUser.id,
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'adminUser',
      targetId: adminUser.id,
      metadata: { reason: 'account_locked' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    await recordAdminLoginAttempt({
      email: normalizedEmail,
      ipAddress: params.ipAddress,
      success: false,
    });
    return { ok: false, reason: 'locked' };
  }

  const mfaResult = await assertAdminMfaSatisfied({
    adminUserId: adminUser.id,
    mfaEnabled: adminUser.mfaEnabled,
    code: params.mfaCode,
  });

  if (mfaResult.status === 'failed' || mfaResult.status === 'required') {
    await writeAdminAuditLog({
      adminUserId: adminUser.id,
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'adminUser',
      targetId: adminUser.id,
      metadata: { reason: 'mfa_failed' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return { ok: false, reason: 'mfa_failed' };
  }

  const session = await createAdminSession({
    adminUserId: adminUser.id,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  await orm.AdminUser.where({ id: adminUser.id }).update({
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: new Date().toISOString(),
  });

  await writeAdminAuditLog({
    adminUserId: adminUser.id,
    action: 'ADMIN_LOGIN_SUCCESS',
    targetType: 'adminSession',
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });
  await recordAdminLoginAttempt({
    email: normalizedEmail,
    ipAddress: params.ipAddress,
    success: true,
  });

  return {
    ok: true,
    sessionToken: session.token,
    cookie: buildAdminSessionCookie(session.token, session.expiresAt),
    admin: {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    },
  };
}

export async function createBootstrapAdminUser(params: {
  email: string;
  passwordHash: string;
  displayName?: string;
  role?: 'ADMIN' | 'SUPER_ADMIN';
}): Promise<{ id: string; email: string }> {
  const existing = await orm.AdminUser.where({
    email: params.email.toLowerCase(),
  }).first();

  if (existing) {
    throw new Error('Admin user already exists for this email');
  }

  const admin = await orm.AdminUser.create({
    id: randomUUID(),
    email: params.email.toLowerCase(),
    passwordHash: params.passwordHash,
    displayName: params.displayName ?? null,
    role: params.role ?? 'SUPER_ADMIN',
    mfaEnabled: false,
  });

  return { id: admin.id, email: admin.email };
}
