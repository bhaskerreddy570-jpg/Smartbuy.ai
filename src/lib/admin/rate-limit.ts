import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { adminConfig } from '@/lib/admin/config';

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

export async function recordAdminLoginAttempt(params: {
  email: string;
  ipAddress: string;
  success: boolean;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO "adminLoginAttempt" (id, email, "ipAddress", success)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), params.email.toLowerCase(), params.ipAddress, params.success],
  );
}

export async function isAdminLoginRateLimited(params: {
  email: string;
  ipAddress: string;
}): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - adminConfig.loginRateLimitWindowMinutes * 60 * 1000,
  ).toISOString();

  const result = await getPool().query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM "adminLoginAttempt"
     WHERE success = false
       AND "attemptedAt" >= $1
       AND (email = $2 OR "ipAddress" = $3)`,
    [windowStart, params.email.toLowerCase(), params.ipAddress],
  );

  const failedAttempts = Number(result.rows[0]?.count ?? 0);
  return failedAttempts >= adminConfig.loginRateLimitMax;
}
