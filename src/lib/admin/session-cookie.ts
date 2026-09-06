import { adminConfig } from '@/lib/admin/config';

export const ADMIN_SESSION_COOKIE = adminConfig.sessionCookieName;

export function requestHasAdminSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader.split(';').some((part) => {
    const [name] = part.trim().split('=');
    return name === ADMIN_SESSION_COOKIE && part.includes('=');
  });
}
