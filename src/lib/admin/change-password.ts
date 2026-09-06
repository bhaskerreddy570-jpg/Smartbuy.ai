import { orm } from '@/lib/db';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { hashAdminPassword, verifyAdminPassword } from '@/lib/admin/password';
import { revokeAllAdminSessions } from '@/lib/admin/session';

export type ChangeAdminPasswordResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_current_password' | 'same_password' };

export async function changeAdminPassword(params: {
  adminUserId: string;
  currentPassword: string;
  newPassword: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<ChangeAdminPasswordResult> {
  const adminUser = await orm.AdminUser.where({ id: params.adminUserId }).first();
  if (!adminUser) {
    return { ok: false, reason: 'invalid_current_password' };
  }

  const currentValid = await verifyAdminPassword(
    params.currentPassword,
    adminUser.passwordHash,
  );
  if (!currentValid) {
    await writeAdminAuditLog({
      adminUserId: adminUser.id,
      action: 'ADMIN_LOGIN_FAILED',
      targetType: 'adminUser',
      targetId: adminUser.id,
      metadata: { reason: 'password_change_invalid_current' },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
    return { ok: false, reason: 'invalid_current_password' };
  }

  const samePassword = await verifyAdminPassword(
    params.newPassword,
    adminUser.passwordHash,
  );
  if (samePassword) {
    return { ok: false, reason: 'same_password' };
  }

  const passwordHash = await hashAdminPassword(params.newPassword);
  await orm.AdminUser.where({ id: adminUser.id }).update({
    passwordHash,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lockedAt: null,
    lockReason: null,
  });

  await revokeAllAdminSessions(adminUser.id);

  await writeAdminAuditLog({
    adminUserId: adminUser.id,
    action: 'ADMIN_PASSWORD_CHANGED',
    targetType: 'adminUser',
    targetId: adminUser.id,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return { ok: true };
}
