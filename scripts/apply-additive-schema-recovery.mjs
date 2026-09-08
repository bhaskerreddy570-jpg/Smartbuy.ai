#!/usr/bin/env node
/**
 * Safe additive schema recovery for production marker/graph mismatches.
 * Idempotent, additive-only, transaction-wrapped. Never deletes customer data.
 *
 * Usage:
 *   node scripts/apply-additive-schema-recovery.mjs <database-url>
 *   node scripts/apply-additive-schema-recovery.mjs --dry-run <database-url>
 */
import { Pool } from 'pg';

const dryRun = process.argv.includes('--dry-run');
const databaseUrl = process.argv.find((arg) => arg.startsWith('postgres'));
if (!databaseUrl) {
  console.error('Usage: node scripts/apply-additive-schema-recovery.mjs [--dry-run] <database-url>');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function columnExists(table, column) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS exists`,
    [table, column],
  );
  return result.rows[0]?.exists === true;
}

async function constraintExists(name) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = $1
     ) AS exists`,
    [name],
  );
  return result.rows[0]?.exists === true;
}

async function indexExists(name) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_class WHERE relname = $1
     ) AS exists`,
    [name],
  );
  return result.rows[0]?.exists === true;
}

const plannedChanges = [];

function plan(change) {
  plannedChanges.push(change);
}

async function buildPlan() {
  if (!(await columnExists('file', 'category'))) {
    plan('Add column file.category');
  }
  if (!(await columnExists('file', 'storageNamespace'))) {
    plan('Add column file.storageNamespace');
  }
  if (!(await columnExists('file', 'storageProvider'))) {
    plan('Add column file.storageProvider');
  }
  if (!(await constraintExists('file_category_check_b60b453e'))) {
    plan('Add check constraint file_category_check_b60b453e');
  }
  if (!(await constraintExists('file_storageProvider_check_9da2fab1'))) {
    plan('Add check constraint file_storageProvider_check_9da2fab1');
  }
  if (!(await indexExists('file_userId_category_idx_6e270954'))) {
    plan('Create index file_userId_category_idx_6e270954');
  }
  if (!(await indexExists('file_userId_category_status_idx_1c139799'))) {
    plan('Create index file_userId_category_status_idx_1c139799');
  }
  if (!(await columnExists('user', 'maxFileSizeBytes'))) {
    plan('Add column user.maxFileSizeBytes');
  }
  if (!(await columnExists('user', 'monthlyBandwidthLimitBytes'))) {
    plan('Add column user.monthlyBandwidthLimitBytes');
  }
  if (!(await columnExists('user', 'monthlyBandwidthUsedBytes'))) {
    plan('Add column user.monthlyBandwidthUsedBytes');
  }
  if (!(await columnExists('user', 'bandwidthPeriodStart'))) {
    plan('Add column user.bandwidthPeriodStart');
  }

  const zeroQuota = await pool.query(
    'SELECT COUNT(*)::text AS count FROM "user" WHERE "storageQuota" = 0',
  );
  if (Number(zeroQuota.rows[0]?.count ?? 0) > 0) {
    plan('Backfill zero user.storageQuota to default (5368709120) — does not reduce any quota');
  }

  const zeroSubQuota = await pool.query(
    'SELECT COUNT(*)::text AS count FROM subscription WHERE "storageQuota" = 0',
  );
  if (Number(zeroSubQuota.rows[0]?.count ?? 0) > 0) {
    plan('Backfill zero subscription.storageQuota to default (5368709120)');
  }

  if (!(await constraintExists('adminAuditLog_action_check_0f9926f8'))) {
    plan('Replace legacy adminAuditLog action check with adminAuditLog_action_check_0f9926f8');
  }
}

const statements = [
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'OTHER' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "storageNamespace" text DEFAULT 'default' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "storageProvider" text DEFAULT 'S3' NOT NULL`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_category_check_b60b453e') THEN
       ALTER TABLE "file" ADD CONSTRAINT "file_category_check_b60b453e"
       CHECK ("category" IN ('CONTACTS', 'IMAGES', 'VIDEOS', 'DOCUMENTS', 'OTHER'));
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_storageProvider_check_9da2fab1') THEN
       ALTER TABLE "file" ADD CONSTRAINT "file_storageProvider_check_9da2fab1"
       CHECK ("storageProvider" IN ('S3'));
     END IF;
   END $$`,
  `CREATE INDEX IF NOT EXISTS "file_userId_category_idx_6e270954" ON "file" ("userId", "category")`,
  `CREATE INDEX IF NOT EXISTS "file_userId_category_status_idx_1c139799" ON "file" ("userId", "category", "status")`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "maxFileSizeBytes" int8 DEFAULT 2147483648 NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "monthlyBandwidthLimitBytes" int8 DEFAULT 268435456000 NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "monthlyBandwidthUsedBytes" int8 DEFAULT 0 NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bandwidthPeriodStart" timestamptz`,
  `UPDATE "user" SET "storageQuota" = 5368709120 WHERE "storageQuota" = 0`,
  `UPDATE subscription SET "storageQuota" = 5368709120 WHERE "storageQuota" = 0`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_b75dd9a3') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_b75dd9a3";
     ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_2242d3de') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_2242d3de";
     ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_2c184a7c') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_2c184a7c";
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_0f9926f8') THEN
       ALTER TABLE "adminAuditLog" ADD CONSTRAINT "adminAuditLog_action_check_0f9926f8"
       CHECK ("action" IN (
         'ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT',
         'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED',
         'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED',
         'STORAGE_LIMIT_CHANGED', 'MAX_FILE_SIZE_CHANGED', 'BANDWIDTH_LIMIT_CHANGED',
         'CUSTOMER_LOCKED', 'CUSTOMER_UNLOCKED', 'CUSTOMER_RECOVERY',
         'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED',
         'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED'
       ));
     END IF;
   END $$`,
];

async function apply() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sql of statements) {
      await client.query(sql);
    }
    await client.query('COMMIT');
    console.log('Additive schema recovery completed.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await buildPlan();
  console.log('Planned schema recovery changes:');
  if (plannedChanges.length === 0) {
    console.log('  (none — schema already satisfies recovery target)');
  } else {
    for (const change of plannedChanges) {
      console.log(`  - ${change}`);
    }
  }

  if (dryRun) {
    console.log('Dry run only — no changes applied.');
  } else if (plannedChanges.length > 0) {
    await apply();
  } else {
    console.log('Nothing to apply.');
  }
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await pool.end();
}
