#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/40b7cdaa591efab9890af3062a4f1f912b4ab8ab0919518852391526c2a83492/contract';
import startContract from '../../snapshots/40b7cdaa591efab9890af3062a4f1f912b4ab8ab0919518852391526c2a83492/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d85a7922b6a77ce3a8635b6a06550ed366aa732060fbd3aa00b14ee6c239fc99/contract';
import endContract from '../../snapshots/d85a7922b6a77ce3a8635b6a06550ed366aa732060fbd3aa00b14ee6c239fc99/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

const DEFAULT_MAX_FILE_SIZE = '104857600';
const DEFAULT_MONTHLY_BANDWIDTH = '107374182400';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_2242d3de',
      }),
      this.createTable({
        schema: 'public',
        table: 'customerBandwidthUsage',
        columns: [
          col('bytesDownloaded', 'int8', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/int8@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('periodMonth', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('periodYear', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('storageLimitBytes', 'int8', { codecRef: { codecId: 'pg/int8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('maxFileSizeBytes', 'int8', {
          notNull: true,
          default: lit(DEFAULT_MAX_FILE_SIZE),
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('monthlyBandwidthLimitBytes', 'int8', {
          notNull: true,
          default: lit(DEFAULT_MONTHLY_BANDWIDTH),
          codecRef: { codecId: 'pg/int8@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_b75dd9a3',
        expression:
          "\"action\" IN ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED', 'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED', 'CUSTOMER_QUOTA_CHANGED', 'CUSTOMER_LIMITS_CHANGED', 'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED', 'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'customerBandwidthUsage',
        constraint: 'customerBandwidthUsage_userId_periodYear_periodMonth_key',
        columns: ['userId', 'periodYear', 'periodMonth'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerBandwidthUsage',
        index: 'customerBandwidthUsage_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customerBandwidthUsage',
        foreignKey: {
          name: 'customerBandwidthUsage_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
