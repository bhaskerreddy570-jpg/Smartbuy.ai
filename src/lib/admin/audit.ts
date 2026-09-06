import { randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';

export type AdminAuditAction =
  | 'ADMIN_LOGIN_SUCCESS'
  | 'ADMIN_LOGIN_FAILED'
  | 'ADMIN_LOGOUT'
  | 'ADMIN_SESSION_REVOKED'
  | 'CUSTOMER_ACCOUNT_LOCKED'
  | 'CUSTOMER_ACCOUNT_UNLOCKED'
  | 'RECOVERY_TOKEN_ISSUED'
  | 'RECOVERY_TOKEN_USED'
  | 'RECOVERY_REQUEST_DENIED'
  | 'BACKUP_REQUESTED'
  | 'DATA_RECOVERY_REQUESTED';

export async function writeAdminAuditLog(params: {
  adminUserId?: string | null;
  action: AdminAuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await orm.AdminAuditLog.create({
    id: randomUUID(),
    adminUserId: params.adminUserId ?? null,
    action: params.action,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
  });
}
