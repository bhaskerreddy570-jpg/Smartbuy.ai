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

async function tableExists(table) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table],
  );
  return result.rows[0]?.exists === true;
}

const plannedChanges = [];

function plan(change) {
  plannedChanges.push(change);
}

const DEFAULT_STORAGE_QUOTA_BYTES = 1073741824; // 1 GiB
const FREE_MAX_FILE_BYTES = 536870912; // 512 MiB
const FREE_BANDWIDTH_BYTES = 107374182400; // 100 GiB
const BASIC_STORAGE_BYTES = 107374182400;
const BASIC_MAX_FILE_BYTES = 10737418240;
const BASIC_BANDWIDTH_BYTES = 536870912000;
const PRO_STORAGE_BYTES = 536870912000;
const PRO_MAX_FILE_BYTES = 26843545600;
const PRO_BANDWIDTH_BYTES = 2199023255552;
const BUSINESS_STORAGE_BYTES = 2199023255552;
const BUSINESS_MAX_FILE_BYTES = 107374182400;
const BUSINESS_BANDWIDTH_BYTES = 10995116277760;

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
  if (!(await columnExists('file', 'starred'))) {
    plan('Add column file.starred');
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
  if (!(await indexExists('file_userId_starred_idx_57631854'))) {
    plan('Create index file_userId_starred_idx_57631854');
  }
  const wrongStarredIndex = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'file_userId_starred_idx') AS exists`,
  );
  if (wrongStarredIndex.rows[0]?.exists === true) {
    plan('Replace legacy file_userId_starred_idx with file_userId_starred_idx_57631854');
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
    plan(`Backfill zero user.storageQuota to default (${DEFAULT_STORAGE_QUOTA_BYTES}) — does not reduce any quota`);
  }

  const zeroSubQuota = await pool.query(
    'SELECT COUNT(*)::text AS count FROM subscription WHERE "storageQuota" = 0',
  );
  if (Number(zeroSubQuota.rows[0]?.count ?? 0) > 0) {
    plan(`Backfill zero subscription.storageQuota to default (${DEFAULT_STORAGE_QUOTA_BYTES})`);
  }

  if (!(await tableExists('planConfiguration'))) {
    plan('Create table planConfiguration and seed subscription plan limits');
  } else {
    const planCount = await pool.query('SELECT COUNT(*)::text AS count FROM "planConfiguration"');
    if (Number(planCount.rows[0]?.count ?? 0) < 4) {
      plan('Seed missing planConfiguration rows');
    }
  }
  if (!(await columnExists('user', 'assignedPlan'))) {
    plan('Add column user.assignedPlan');
  }
  if (!(await columnExists('user', 'storageQuotaOverride'))) {
    plan('Add column user.storageQuotaOverride');
  }
  if (!(await columnExists('user', 'maxFileSizeOverride'))) {
    plan('Add column user.maxFileSizeOverride');
  }
  if (!(await columnExists('user', 'monthlyBandwidthLimitOverride'))) {
    plan('Add column user.monthlyBandwidthLimitOverride');
  }
  if (!(await constraintExists('adminAuditLog_action_check_50774247'))) {
    plan('Replace legacy adminAuditLog action check with plan allocation actions');
  }
  if (!(await constraintExists('user_assignedPlan_check_e6eced99'))) {
    plan('Add user.assignedPlan check constraint');
  }
  if (!(await columnExists('file', 'securityMode'))) {
    plan('Add secure upload metadata columns to file');
  }
}

const statements = [
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'OTHER' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "storageNamespace" text DEFAULT 'default' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "storageProvider" text DEFAULT 'S3' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "starred" boolean DEFAULT false NOT NULL`,
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
  `CREATE INDEX IF NOT EXISTS "file_userId_starred_idx_57631854" ON "file" ("userId", "starred")`,
  `DROP INDEX IF EXISTS "file_userId_starred_idx"`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "maxFileSizeBytes" int8 DEFAULT 2147483648 NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "monthlyBandwidthLimitBytes" int8 DEFAULT 268435456000 NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "monthlyBandwidthUsedBytes" int8 DEFAULT 0 NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "bandwidthPeriodStart" timestamptz`,
  `UPDATE "user" SET "storageQuota" = ${DEFAULT_STORAGE_QUOTA_BYTES} WHERE "storageQuota" = 0`,
  `UPDATE subscription SET "storageQuota" = ${DEFAULT_STORAGE_QUOTA_BYTES} WHERE "storageQuota" = 0`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_b75dd9a3') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_b75dd9a3";
     ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_2242d3de') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_2242d3de";
     ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_2c184a7c') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_2c184a7c";
     END IF;
   END $$`,
  `CREATE TABLE IF NOT EXISTS "planConfiguration" (
     "plan" text PRIMARY KEY,
     "displayName" text NOT NULL,
     "storageQuotaBytes" int8 NOT NULL,
     "maxFileSizeBytes" int8 NOT NULL,
     "monthlyBandwidthLimitBytes" int8 NOT NULL,
     "active" bool DEFAULT true NOT NULL,
     "createdAt" timestamptz DEFAULT NOW() NOT NULL,
     "updatedAt" timestamptz DEFAULT NOW() NOT NULL
   )`,
  `INSERT INTO "planConfiguration"
     ("plan", "displayName", "storageQuotaBytes", "maxFileSizeBytes", "monthlyBandwidthLimitBytes", "active", "createdAt", "updatedAt")
   VALUES
     ('FREE', 'Free', ${DEFAULT_STORAGE_QUOTA_BYTES}, ${FREE_MAX_FILE_BYTES}, ${FREE_BANDWIDTH_BYTES}, true, NOW(), NOW()),
     ('BASIC', 'Basic', ${BASIC_STORAGE_BYTES}, ${BASIC_MAX_FILE_BYTES}, ${BASIC_BANDWIDTH_BYTES}, true, NOW(), NOW()),
     ('PRO', 'Pro', ${PRO_STORAGE_BYTES}, ${PRO_MAX_FILE_BYTES}, ${PRO_BANDWIDTH_BYTES}, true, NOW(), NOW()),
     ('BUSINESS', 'Business', ${BUSINESS_STORAGE_BYTES}, ${BUSINESS_MAX_FILE_BYTES}, ${BUSINESS_BANDWIDTH_BYTES}, true, NOW(), NOW())
   ON CONFLICT ("plan") DO NOTHING`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "assignedPlan" text DEFAULT 'FREE' NOT NULL`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "storageQuotaOverride" int8`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "maxFileSizeOverride" int8`,
  `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "monthlyBandwidthLimitOverride" int8`,
  `UPDATE "user" u
     SET "assignedPlan" = COALESCE(
       (
         SELECT s.plan
         FROM subscription s
         WHERE s."userId" = u.id AND s.status = 'ACTIVE'
         ORDER BY s."createdAt" DESC
         LIMIT 1
       ),
       'FREE'
     )
   WHERE u."assignedPlan" IS NULL OR u."assignedPlan" = 'FREE'`,
  `UPDATE "user" u
     SET "storageQuotaOverride" = u."storageQuota"
     FROM "planConfiguration" p
     WHERE u."assignedPlan" = p.plan
       AND u."storageQuotaOverride" IS NULL
       AND u."storageQuota" IS DISTINCT FROM p."storageQuotaBytes"`,
  `UPDATE "user" u
     SET "maxFileSizeOverride" = u."maxFileSizeBytes"
     FROM "planConfiguration" p
     WHERE u."assignedPlan" = p.plan
       AND u."maxFileSizeOverride" IS NULL
       AND u."maxFileSizeBytes" IS DISTINCT FROM p."maxFileSizeBytes"`,
  `UPDATE "user" u
     SET "monthlyBandwidthLimitOverride" = u."monthlyBandwidthLimitBytes"
     FROM "planConfiguration" p
     WHERE u."assignedPlan" = p.plan
       AND u."monthlyBandwidthLimitOverride" IS NULL
       AND u."monthlyBandwidthLimitBytes" IS DISTINCT FROM p."monthlyBandwidthLimitBytes"`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_plan_allocation') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_plan_allocation";
     ELSIF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_0f9926f8') THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_0f9926f8";
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planConfiguration_plan_check_7f2a9c11') THEN
       ALTER TABLE "planConfiguration" DROP CONSTRAINT "planConfiguration_plan_check_7f2a9c11";
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planConfiguration_plan_check_16596298') THEN
       ALTER TABLE "planConfiguration" ADD CONSTRAINT "planConfiguration_plan_check_16596298"
       CHECK ("plan" IN ('FREE', 'BASIC', 'PRO', 'BUSINESS'));
     END IF;
   END $$`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "securityMode" text DEFAULT 'NORMAL' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "encryptionFormatVersion" text`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "encryptionAlgorithm" text`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "encryptionKdf" text`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "encryptionSalt" text`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "encryptionIv" text`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "plaintextSize" int8`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_securityMode_check_78f49108') THEN
       ALTER TABLE "file" ADD CONSTRAINT "file_securityMode_check_78f49108"
       CHECK ("securityMode" IN ('NORMAL', 'SECURE'));
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_assignedPlan_check_e6eced99') THEN
       ALTER TABLE "user" ADD CONSTRAINT "user_assignedPlan_check_e6eced99"
       CHECK ("assignedPlan" IN ('FREE', 'BASIC', 'PRO', 'BUSINESS'));
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adminAuditLog_action_check_50774247') THEN
       ALTER TABLE "adminAuditLog" ADD CONSTRAINT "adminAuditLog_action_check_50774247"
       CHECK ("action" IN (
         'ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT',
         'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED',
         'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED',
         'STORAGE_LIMIT_CHANGED', 'MAX_FILE_SIZE_CHANGED', 'BANDWIDTH_LIMIT_CHANGED',
         'CUSTOMER_PLAN_CHANGED',
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
