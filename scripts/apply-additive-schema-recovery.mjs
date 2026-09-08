#!/usr/bin/env node
import { Pool } from 'pg';

const databaseUrl = process.argv[2];
if (!databaseUrl) {
  console.error('Usage: node scripts/apply-additive-schema-recovery.mjs <database-url>');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

const statements = [
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'OTHER' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "storageNamespace" text DEFAULT 'default' NOT NULL`,
  `ALTER TABLE "file" ADD COLUMN IF NOT EXISTS "storageProvider" text DEFAULT 'S3' NOT NULL`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'file_category_check_b60b453e'
     ) THEN
       ALTER TABLE "file"
       ADD CONSTRAINT "file_category_check_b60b453e"
       CHECK ("category" IN ('CONTACTS', 'IMAGES', 'VIDEOS', 'DOCUMENTS', 'OTHER'));
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'file_storageProvider_check_9da2fab1'
     ) THEN
       ALTER TABLE "file"
       ADD CONSTRAINT "file_storageProvider_check_9da2fab1"
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
     IF EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'adminAuditLog_action_check_b75dd9a3'
     ) THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_b75dd9a3";
     ELSIF EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'adminAuditLog_action_check_2242d3de'
     ) THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_2242d3de";
     ELSIF EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'adminAuditLog_action_check_2c184a7c'
     ) THEN
       ALTER TABLE "adminAuditLog" DROP CONSTRAINT "adminAuditLog_action_check_2c184a7c";
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'adminAuditLog_action_check_0f9926f8'
     ) THEN
       ALTER TABLE "adminAuditLog"
       ADD CONSTRAINT "adminAuditLog_action_check_0f9926f8"
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

try {
  for (const sql of statements) {
    await pool.query(sql);
  }
  console.log('Additive schema recovery completed.');
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await pool.end();
}
