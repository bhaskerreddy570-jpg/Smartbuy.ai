const DEFAULT_SESSION_TTL_HOURS = 8;
const DEFAULT_RATE_LIMIT_MAX = 5;
const DEFAULT_RATE_LIMIT_WINDOW_MINUTES = 15;
const DEFAULT_ACCOUNT_LOCK_THRESHOLD = 10;

export const adminConfig = {
  sessionCookieName: 'smartbuy_admin_session',
  sessionTtlHours: Number(
    process.env.ADMIN_SESSION_TTL_HOURS ?? DEFAULT_SESSION_TTL_HOURS,
  ),
  loginRateLimitMax: Number(
    process.env.ADMIN_LOGIN_RATE_LIMIT_MAX ?? DEFAULT_RATE_LIMIT_MAX,
  ),
  loginRateLimitWindowMinutes: Number(
    process.env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_MINUTES ??
      DEFAULT_RATE_LIMIT_WINDOW_MINUTES,
  ),
  accountLockThreshold: Number(
    process.env.ADMIN_ACCOUNT_LOCK_THRESHOLD ?? DEFAULT_ACCOUNT_LOCK_THRESHOLD,
  ),
  recoveryTokenTtlHours: Number(process.env.ADMIN_RECOVERY_TOKEN_TTL_HOURS ?? 1),
  recoveryInitiateRateLimitMax: Number(
    process.env.ADMIN_RECOVERY_INITIATE_RATE_LIMIT_MAX ?? 3,
  ),
  recoveryCompleteRateLimitMax: Number(
    process.env.ADMIN_RECOVERY_COMPLETE_RATE_LIMIT_MAX ?? 5,
  ),
  recoveryRateLimitWindowMinutes: Number(
    process.env.ADMIN_RECOVERY_RATE_LIMIT_WINDOW_MINUTES ?? 15,
  ),
};

export function getAdminSessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    '';

  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET or AUTH_SECRET must be configured');
  }

  return secret;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
