#!/usr/bin/env node
/**
 * Read-only production data verification. Prints aggregate counts only — no secrets.
 */
import { Pool } from 'pg';

const databaseUrl = process.argv[2] ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('Usage: node scripts/verify-production-data.mjs <database-url>');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function count(table) {
  const result = await pool.query(`SELECT COUNT(*)::text AS count FROM ${table}`);
  return result.rows[0]?.count ?? '0';
}

async function main() {
  const [
    users,
    files,
    subscriptions,
    adminUsers,
    auditLogs,
    zeroQuotaUsers,
    minQuota,
    maxQuota,
  ] = await Promise.all([
    count('"user"'),
    count('file'),
    count('subscription'),
    count('"adminUser"'),
    count('"adminAuditLog"'),
    pool.query('SELECT COUNT(*)::text AS count FROM "user" WHERE "storageQuota" = 0'),
    pool.query('SELECT MIN("storageQuota")::text AS value FROM "user"'),
    pool.query('SELECT MAX("storageQuota")::text AS value FROM "user"'),
  ]);

  const fileSample = await pool.query(
    `SELECT COUNT(*)::text AS count FROM file WHERE "deletedAt" IS NULL AND status = 'READY'`,
  );

  console.log(JSON.stringify({
    users: users,
    files: files,
    readyFiles: fileSample.rows[0]?.count ?? '0',
    subscriptions: subscriptions,
    adminUsers: adminUsers,
    auditLogs: auditLogs,
    usersWithZeroQuota: zeroQuotaUsers.rows[0]?.count ?? '0',
    minStorageQuota: minQuota.rows[0]?.value ?? null,
    maxStorageQuota: maxQuota.rows[0]?.value ?? null,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  })
  .finally(() => pool.end());
