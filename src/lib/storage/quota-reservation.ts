import { Pool, type PoolClient } from 'pg';
import { exceedsStorageQuota } from '@/lib/storage/quota';

type LockedUserRow = {
  storageUsed: bigint;
  storageQuota: bigint;
};

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

export async function withLockedUser<T>(
  userId: string,
  handler: (user: LockedUserRow, client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const locked = await client.query<{
      storageUsed: string;
      storageQuota: string;
    }>(
      'SELECT "storageUsed", "storageQuota" FROM "user" WHERE id = $1 FOR UPDATE',
      [userId],
    );

    if (locked.rowCount !== 1) {
      throw new Error('User not found');
    }

    const user: LockedUserRow = {
      storageUsed: BigInt(locked.rows[0].storageUsed),
      storageQuota: BigInt(locked.rows[0].storageQuota),
    };

    const result = await handler(user, client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function reserveStorageBytes(
  user: LockedUserRow,
  bytes: bigint,
): { ok: true; nextStorageUsed: bigint } | { ok: false } {
  if (exceedsStorageQuota(user.storageUsed, bytes, user.storageQuota)) {
    return { ok: false };
  }

  return {
    ok: true,
    nextStorageUsed: user.storageUsed + bytes,
  };
}

export async function setUserStorageUsed(
  client: PoolClient,
  userId: string,
  storageUsed: bigint,
): Promise<void> {
  await client.query('UPDATE "user" SET "storageUsed" = $1 WHERE id = $2', [
    storageUsed.toString(),
    userId,
  ]);
}
