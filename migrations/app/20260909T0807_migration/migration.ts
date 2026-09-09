#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/27ef97615bdea45da4e7055103a711356a9aa1c0f861ae0e06580657f2543f65/contract';
import startContract from '../../snapshots/27ef97615bdea45da4e7055103a711356a9aa1c0f861ae0e06580657f2543f65/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a000c93448272ca6e224da6349e0012074d2209ba98c0d6d175dcd09d722e48f/contract';
import endContract from '../../snapshots/a000c93448272ca6e224da6349e0012074d2209ba98c0d6d175dcd09d722e48f/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'customerSecurityEvent',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('eventType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('riskLevel', 'text', {
            notNull: true,
            default: lit('INFO'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'customerSecurityEvent_eventType_check_f524d5a3',
            "\"eventType\" IN ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'PASSWORD_CHANGED', 'SESSION_CREATED', 'SESSION_REVOKED', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FILE_RESTORE', 'SECURITY_SETTING_CHANGED', 'NEW_DEVICE_DETECTED', 'UNUSUAL_ACTIVITY')",
          ),
          checkExpression(
            'customerSecurityEvent_riskLevel_check_0cbc839c',
            "\"riskLevel\" IN ('INFO', 'LOW', 'MEDIUM')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'customerSession',
        columns: [
          col('browser', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceLabel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastActiveAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('platform', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('sessionTokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('clientUploadId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('lastAccessedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'customerSession',
        constraint: 'customerSession_sessionTokenHash_key',
        columns: ['sessionTokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'file',
        constraint: 'file_userId_clientUploadId_key',
        columns: ['userId', 'clientUploadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerSecurityEvent',
        index: 'customerSecurityEvent_eventType_idx_e4cf7742',
        columns: ['eventType'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerSecurityEvent',
        index: 'customerSecurityEvent_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerSecurityEvent',
        index: 'customerSecurityEvent_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerSession',
        index: 'customerSession_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerSession',
        index: 'customerSession_userId_revokedAt_idx_eae4cbef',
        columns: ['userId', 'revokedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'file',
        index: 'file_userId_lastAccessedAt_idx_6e312cf5',
        columns: ['userId', 'lastAccessedAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customerSecurityEvent',
        foreignKey: {
          name: 'customerSecurityEvent_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customerSession',
        foreignKey: {
          name: 'customerSession_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
