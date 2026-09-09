import { Pool } from 'pg';
import { requireDatabaseUrl } from '@/lib/server-env';
import type { FileCategory } from '@/lib/storage/types';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: requireDatabaseUrl({ preferDirect: true }) });
  }
  return pool;
}

export async function countReadyFilesByCategory(userId: string) {
  const result = await getPool().query<{ category: FileCategory; count: string }>(
    `SELECT category, COUNT(*)::text AS count
     FROM file
     WHERE "userId" = $1
       AND "deletedAt" IS NULL
       AND status = 'READY'
     GROUP BY category`,
    [userId],
  );

  const counts = new Map<FileCategory, number>();
  for (const row of result.rows) {
    counts.set(row.category, Number(row.count));
  }
  return counts;
}

export type SmartFileSummary = {
  id: string;
  name: string;
  size: string;
  category: FileCategory;
  mimeType: string;
  starred: boolean;
  securityMode: 'NORMAL' | 'SECURE';
  createdAt: string;
  lastAccessedAt: string | null;
};

export async function listRecentReadyFiles(userId: string, limit = 8): Promise<SmartFileSummary[]> {
  const result = await getPool().query<SmartFileSummary>(
    `SELECT id, name, size::text, category, "mimeType", starred, "securityMode", "createdAt", "lastAccessedAt"
     FROM file
     WHERE "userId" = $1 AND "deletedAt" IS NULL AND status = 'READY'
     ORDER BY "createdAt" DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export async function listLargeReadyFiles(userId: string, limit = 5): Promise<SmartFileSummary[]> {
  const result = await getPool().query<SmartFileSummary>(
    `SELECT id, name, size::text, category, "mimeType", starred, "securityMode", "createdAt", "lastAccessedAt"
     FROM file
     WHERE "userId" = $1 AND "deletedAt" IS NULL AND status = 'READY'
     ORDER BY size DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export async function listRecentlyAccessedFiles(
  userId: string,
  limit = 8,
): Promise<SmartFileSummary[]> {
  const result = await getPool().query<SmartFileSummary>(
    `SELECT id, name, size::text, category, "mimeType", starred, "securityMode", "createdAt", "lastAccessedAt"
     FROM file
     WHERE "userId" = $1 AND "deletedAt" IS NULL AND status = 'READY' AND "lastAccessedAt" IS NOT NULL
     ORDER BY "lastAccessedAt" DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}

export async function listSecureReadyFiles(userId: string, limit = 8): Promise<SmartFileSummary[]> {
  const result = await getPool().query<SmartFileSummary>(
    `SELECT id, name, size::text, category, "mimeType", starred, "securityMode", "createdAt", "lastAccessedAt"
     FROM file
     WHERE "userId" = $1 AND "deletedAt" IS NULL AND status = 'READY' AND "securityMode" = 'SECURE'
     ORDER BY "createdAt" DESC
     LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
}
