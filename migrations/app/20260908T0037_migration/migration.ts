#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c981e8ad0bad900bf4c3f162dfcb770ec981bb93a2f434949ac658f92ce6241c/contract';
import endContract from '../../snapshots/c981e8ad0bad900bf4c3f162dfcb770ec981bb93a2f434949ac658f92ce6241c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ddd72e69619b76a48ba676f09f315805ab0a18363438a67c3be680c6996bd7df/contract';
import startContract from '../../snapshots/ddd72e69619b76a48ba676f09f315805ab0a18363438a67c3be680c6996bd7df/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, rawSql } from '@prisma/orm-postgres/migration';

const DEFAULT_STORAGE_QUOTA_BYTES = '5368709120';
const DEFAULT_MAX_FILE_SIZE_BYTES = '2147483648';
const DEFAULT_MONTHLY_BANDWIDTH_BYTES = '268435456000';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_2c184a7c',
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('bandwidthPeriodStart', 'timestamptz', {
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('monthlyBandwidthUsedBytes', 'int8', {
          notNull: true,
          default: lit('0'),
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('maxFileSizeBytes', 'int8', {
          notNull: true,
          default: lit(DEFAULT_MAX_FILE_SIZE_BYTES),
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('monthlyBandwidthLimitBytes', 'int8', {
          notNull: true,
          default: lit(DEFAULT_MONTHLY_BANDWIDTH_BYTES),
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      rawSql({
        id: 'backfill-user-storage-quota',
        label: 'Backfill zero user storage quotas',
        operationClass: 'data',
        target: { schema: 'public', table: 'user' },
        precheck:
          'SELECT id FROM "user" WHERE "storageQuota" = 0 LIMIT 1',
        execute: `UPDATE "user" SET "storageQuota" = ${DEFAULT_STORAGE_QUOTA_BYTES} WHERE "storageQuota" = 0`,
        postcheck:
          'SELECT id FROM "user" WHERE "storageQuota" = 0 LIMIT 1',
      }),
      rawSql({
        id: 'backfill-subscription-storage-quota',
        label: 'Backfill zero subscription storage quotas',
        operationClass: 'data',
        target: { schema: 'public', table: 'subscription' },
        precheck:
          'SELECT id FROM subscription WHERE "storageQuota" = 0 LIMIT 1',
        execute: `UPDATE subscription SET "storageQuota" = ${DEFAULT_STORAGE_QUOTA_BYTES} WHERE "storageQuota" = 0`,
        postcheck:
          'SELECT id FROM subscription WHERE "storageQuota" = 0 LIMIT 1',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_0f9926f8',
        expression:
          "\"action\" IN ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED', 'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED', 'STORAGE_LIMIT_CHANGED', 'MAX_FILE_SIZE_CHANGED', 'BANDWIDTH_LIMIT_CHANGED', 'CUSTOMER_LOCKED', 'CUSTOMER_UNLOCKED', 'CUSTOMER_RECOVERY', 'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED', 'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
