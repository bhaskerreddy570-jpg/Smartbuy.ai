import { randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';

export type CustomerSecurityEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'FILE_UPLOAD'
  | 'FILE_DOWNLOAD'
  | 'FILE_DELETE'
  | 'FILE_RESTORE'
  | 'SECURITY_SETTING_CHANGED'
  | 'NEW_DEVICE_DETECTED'
  | 'UNUSUAL_ACTIVITY';

export type CustomerRiskLevel = 'INFO' | 'LOW' | 'MEDIUM';

export async function recordCustomerSecurityEvent(params: {
  userId: string;
  eventType: CustomerSecurityEventType;
  riskLevel?: CustomerRiskLevel;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await orm.CustomerSecurityEvent.create({
    id: randomUUID(),
    userId: params.userId,
    eventType: params.eventType,
    riskLevel: params.riskLevel ?? 'INFO',
    metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    createdAt: new Date().toISOString(),
  });
}

export async function listRecentCustomerSecurityEvents(
  userId: string,
  limit = 20,
) {
  const events = await orm.CustomerSecurityEvent.where({ userId })
    .orderBy((event) => event.createdAt.desc())
    .select('id', 'eventType', 'riskLevel', 'metadata', 'ipAddress', 'createdAt')
    .all();

  return events.slice(0, limit);
}

export async function countRecentFailedLogins(email: string, windowMinutes = 15) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const events = await orm.CustomerSecurityEvent.where({ eventType: 'LOGIN_FAILURE' })
    .select('metadata', 'createdAt')
    .all();

  return events.filter((event) => {
    if (event.createdAt < since) {
      return false;
    }
    if (!event.metadata) {
      return false;
    }
    try {
      const parsed = JSON.parse(event.metadata) as { email?: string };
      return parsed.email?.toLowerCase() === email.toLowerCase();
    } catch {
      return false;
    }
  }).length;
}
