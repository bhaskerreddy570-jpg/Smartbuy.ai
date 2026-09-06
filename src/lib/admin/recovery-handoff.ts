import { adminConfig } from '@/lib/admin/config';

export const RECOVERY_HANDOFF_COOKIE = 'cloudstorenow_recovery_handoff';
const RECOVERY_HANDOFF_MAX_AGE_SECONDS = 300;

export function buildRecoveryHandoffCookie(token: string): string {
  const parts = [
    `${RECOVERY_HANDOFF_COOKIE}=${token}`,
    'Path=/admin/recovery-handoff',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${RECOVERY_HANDOFF_MAX_AGE_SECONDS}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildRecoveryHandoffClearCookie(): string {
  const parts = [
    `${RECOVERY_HANDOFF_COOKIE}=`,
    'Path=/admin/recovery-handoff',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function readRecoveryHandoffToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === RECOVERY_HANDOFF_COOKIE) {
      return rest.join('=') || null;
    }
  }

  return null;
}

export function getRecoveryTokenTtlMs(): number {
  return adminConfig.recoveryTokenTtlHours * 60 * 60 * 1000;
}
