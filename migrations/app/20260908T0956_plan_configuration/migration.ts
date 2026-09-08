#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/158fc4958e4bb04acc34082979986e104eb06b410aec8585b1c5d119bb977da1/contract';
import endContract from '../../snapshots/158fc4958e4bb04acc34082979986e104eb06b410aec8585b1c5d119bb977da1/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a1a6cc5551c104dbac2f0d1c892162a3b1d60ebb23f87f95b2ab2949637f9543/contract';
import startContract from '../../snapshots/a1a6cc5551c104dbac2f0d1c892162a3b1d60ebb23f87f95b2ab2949637f9543/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

const FREE_STORAGE = '32212254720';
const FREE_MAX_FILE = '5368709120';
const FREE_BANDWIDTH = '107374182400';
const BASIC_STORAGE = '107374182400';
const BASIC_MAX_FILE = '10737418240';
const BASIC_BANDWIDTH = '536870912000';
const PRO_STORAGE = '536870912000';
const PRO_MAX_FILE = '26843545600';
const PRO_BANDWIDTH = '2199023255552';
const BUSINESS_STORAGE = '2199023255552';
const BUSINESS_MAX_FILE = '107374182400';
const BUSINESS_BANDWIDTH = '10995116277760';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_0f9926f8',
      }),
      this.createTable({
        schema: 'public',
        table: 'planConfiguration',
        columns: [
          col('plan', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('storageQuotaBytes', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('maxFileSizeBytes', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('monthlyBandwidthLimitBytes', 'int8', {
            notNull: true,
            codecRef: { codecId: 'pg/int8@1' },
          }),
          col('active', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['plan']),
          checkExpression(
            'planConfiguration_plan_check_16596298',
            "\"plan\" IN ('FREE', 'BASIC', 'PRO', 'BUSINESS')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('assignedPlan', 'text', {
          notNull: true,
          default: lit('FREE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('storageQuotaOverride', 'int8', {
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('maxFileSizeOverride', 'int8', {
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('monthlyBandwidthLimitOverride', 'int8', {
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_assignedPlan_check_e6eced99',
        expression: "\"assignedPlan\" IN ('FREE', 'BASIC', 'PRO', 'BUSINESS')",
      }),
      rawSql({
        id: 'seed-plan-configuration',
        label: 'Seed subscription plan configuration rows',
        operationClass: 'data',
        target: { schema: 'public', table: 'planConfiguration' },
        precheck: 'SELECT plan FROM "planConfiguration" LIMIT 1',
        execute: `INSERT INTO "planConfiguration"
          ("plan", "displayName", "storageQuotaBytes", "maxFileSizeBytes", "monthlyBandwidthLimitBytes", "active", "createdAt", "updatedAt")
          VALUES
          ('FREE', 'Free', ${FREE_STORAGE}, ${FREE_MAX_FILE}, ${FREE_BANDWIDTH}, true, NOW(), NOW()),
          ('BASIC', 'Basic', ${BASIC_STORAGE}, ${BASIC_MAX_FILE}, ${BASIC_BANDWIDTH}, true, NOW(), NOW()),
          ('PRO', 'Pro', ${PRO_STORAGE}, ${PRO_MAX_FILE}, ${PRO_BANDWIDTH}, true, NOW(), NOW()),
          ('BUSINESS', 'Business', ${BUSINESS_STORAGE}, ${BUSINESS_MAX_FILE}, ${BUSINESS_BANDWIDTH}, true, NOW(), NOW())
          ON CONFLICT ("plan") DO NOTHING`,
        postcheck: 'SELECT plan FROM "planConfiguration" WHERE plan = \'FREE\'',
      }),
      rawSql({
        id: 'backfill-user-assigned-plan',
        label: 'Backfill user assignedPlan from active subscription',
        operationClass: 'data',
        target: { schema: 'public', table: 'user' },
        execute: `UPDATE "user" u
          SET "assignedPlan" = COALESCE(
            (
              SELECT s.plan
              FROM subscription s
              WHERE s."userId" = u.id AND s.status = 'ACTIVE'
              ORDER BY s."createdAt" DESC
              LIMIT 1
            ),
            'FREE'
          )`,
      }),
      rawSql({
        id: 'backfill-storage-overrides',
        label: 'Preserve existing storage limits as explicit overrides when they differ from plan defaults',
        operationClass: 'data',
        target: { schema: 'public', table: 'user' },
        execute: `UPDATE "user" u
          SET "storageQuotaOverride" = u."storageQuota"
          FROM "planConfiguration" p
          WHERE u."assignedPlan" = p.plan
            AND u."storageQuota" IS DISTINCT FROM p."storageQuotaBytes"`,
      }),
      rawSql({
        id: 'backfill-max-file-overrides',
        label: 'Preserve existing max file limits as explicit overrides when they differ from plan defaults',
        operationClass: 'data',
        target: { schema: 'public', table: 'user' },
        execute: `UPDATE "user" u
          SET "maxFileSizeOverride" = u."maxFileSizeBytes"
          FROM "planConfiguration" p
          WHERE u."assignedPlan" = p.plan
            AND u."maxFileSizeBytes" IS DISTINCT FROM p."maxFileSizeBytes"`,
      }),
      rawSql({
        id: 'backfill-bandwidth-overrides',
        label: 'Preserve existing bandwidth limits as explicit overrides when they differ from plan defaults',
        operationClass: 'data',
        target: { schema: 'public', table: 'user' },
        execute: `UPDATE "user" u
          SET "monthlyBandwidthLimitOverride" = u."monthlyBandwidthLimitBytes"
          FROM "planConfiguration" p
          WHERE u."assignedPlan" = p.plan
            AND u."monthlyBandwidthLimitBytes" IS DISTINCT FROM p."monthlyBandwidthLimitBytes"`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_50774247',
        expression:
          "\"action\" IN ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED', 'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED', 'STORAGE_LIMIT_CHANGED', 'MAX_FILE_SIZE_CHANGED', 'BANDWIDTH_LIMIT_CHANGED', 'CUSTOMER_PLAN_CHANGED', 'CUSTOMER_LOCKED', 'CUSTOMER_UNLOCKED', 'CUSTOMER_RECOVERY', 'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED', 'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
