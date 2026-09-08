import { Pool, type PoolClient } from 'pg';
import { requireDatabaseUrl } from '@/lib/server-env';
import {
  currentBandwidthPeriodStart,
  resolveCustomerLimits,
  shouldResetBandwidthPeriod,
  type CustomerLimitFields,
} from '@/lib/customer-limits';
import { exceedsStorageQuota } from '@/lib/storage/quota';

export type LockedCustomerRow = CustomerLimitFields;

let pool: Pool | null = null;

function getPool(): Pool {
  // Neon/Vercel poolers reject interactive transactions (BEGIN … FOR UPDATE).
  const connectionString = requireDatabaseUrl({ preferDirect: true });

  if (!pool) {
    pool = new Pool({ connectionString });
  }

  return pool;
}

function mapLockedCustomerRow(row: {
  storageUsed: string;
  storageQuota: string;
  maxFileSizeBytes: string;
  monthlyBandwidthLimitBytes: string;
  monthlyBandwidthUsedBytes: string;
  bandwidthPeriodStart: string | null;
}): LockedCustomerRow {
  return {
    storageUsed: BigInt(row.storageUsed),
    storageQuota: BigInt(row.storageQuota),
    maxFileSizeBytes: BigInt(row.maxFileSizeBytes),
    monthlyBandwidthLimitBytes: BigInt(row.monthlyBandwidthLimitBytes),
    monthlyBandwidthUsedBytes: BigInt(row.monthlyBandwidthUsedBytes),
    bandwidthPeriodStart: row.bandwidthPeriodStart,
  };
}

async function normalizeLockedCustomerRow(
  userId: string,
  user: LockedCustomerRow,
  client: PoolClient,
): Promise<LockedCustomerRow> {
  let next = user;

  if (shouldResetBandwidthPeriod(user.bandwidthPeriodStart)) {
    const periodStart = currentBandwidthPeriodStart();
    await client.query(
      `UPDATE "user"
       SET "monthlyBandwidthUsedBytes" = 0,
           "bandwidthPeriodStart" = $1
       WHERE id = $2`,
      [periodStart, userId],
    );
    next = {
      ...next,
      monthlyBandwidthUsedBytes: 0n,
      bandwidthPeriodStart: periodStart,
    };
  }

  return next;
}

export async function withLockedCustomer<T>(
  userId: string,
  handler: (user: LockedCustomerRow, client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    const locked = await client.query<{
      storageUsed: string;
      storageQuota: string;
      maxFileSizeBytes: string;
      monthlyBandwidthLimitBytes: string;
      monthlyBandwidthUsedBytes: string;
      bandwidthPeriodStart: string | null;
    }>(
      `SELECT "storageUsed", "storageQuota", "maxFileSizeBytes",
              "monthlyBandwidthLimitBytes", "monthlyBandwidthUsedBytes",
              "bandwidthPeriodStart"
       FROM "user"
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    );

    if (locked.rowCount !== 1) {
      throw new Error('User not found');
    }

    let user = mapLockedCustomerRow(locked.rows[0]);
    user = await normalizeLockedCustomerRow(userId, user, client);

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
  user: LockedCustomerRow,
  bytes: bigint,
): { ok: true; nextStorageUsed: bigint } | { ok: false } {
  const limits = resolveCustomerLimits(user);
  if (exceedsStorageQuota(limits.storageUsed, bytes, limits.storageQuota)) {
    return { ok: false };
  }

  return {
    ok: true,
    nextStorageUsed: limits.storageUsed + bytes,
  };
}

export function reserveBandwidthBytes(
  user: LockedCustomerRow,
  bytes: bigint,
): { ok: true; nextBandwidthUsed: bigint } | { ok: false } {
  const limits = resolveCustomerLimits(user);
  const nextUsed = limits.monthlyBandwidthUsedBytes + bytes;

  if (nextUsed > limits.monthlyBandwidthLimitBytes) {
    return { ok: false };
  }

  return { ok: true, nextBandwidthUsed: nextUsed };
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

export async function setUserBandwidthUsed(
  client: PoolClient,
  userId: string,
  monthlyBandwidthUsedBytes: bigint,
): Promise<void> {
  await client.query(
    'UPDATE "user" SET "monthlyBandwidthUsedBytes" = $1 WHERE id = $2',
    [monthlyBandwidthUsedBytes.toString(), userId],
  );
}

// Backward-compatible alias used by upload lifecycle imports.
export const withLockedUser = withLockedCustomer;
