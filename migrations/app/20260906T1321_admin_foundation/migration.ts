#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/14deadf22b4c9de216575140a62057f447894e32901f42af806487c11e449b10/contract';
import endContract from '../../snapshots/14deadf22b4c9de216575140a62057f447894e32901f42af806487c11e449b10/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dceb99347abdb777064937027a2bf7244c413d7d324a177493db253a75b0f189/contract';
import startContract from '../../snapshots/dceb99347abdb777064937027a2bf7244c413d7d324a177493db253a75b0f189/contract.json' with { type: 'json' };
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
        table: 'adminAuditLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('adminUserId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('metadata', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('targetId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('targetType', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'adminAuditLog_action_check_f1852307',
            "\"action\" IN ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'ADMIN_SESSION_REVOKED', 'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED', 'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED', 'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'adminLoginAttempt',
        columns: [
          col('attemptedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ipAddress', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('success', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'adminSession',
        columns: [
          col('adminUserId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'adminUser',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('displayName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('failedLoginAttempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastFailedLoginAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('lastLoginAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lockReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lockedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('mfaEnabled', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('mfaSecretEnc', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('recoveryTokenExpiresAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('recoveryTokenHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', {
            notNull: true,
            default: lit('ADMIN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('adminUser_role_check_f0aaa5a4', "\"role\" IN ('ADMIN', 'SUPER_ADMIN')"),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('lockReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('lockedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'adminSession',
        constraint: 'adminSession_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'adminUser',
        constraint: 'adminUser_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_action_idx_cd0d2116',
        columns: ['action'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_adminUserId_idx_0ce093a3',
        columns: ['adminUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminAuditLog',
        index: 'adminAuditLog_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminLoginAttempt',
        index: 'adminLoginAttempt_email_attemptedAt_idx_1515496b',
        columns: ['email', 'attemptedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminLoginAttempt',
        index: 'adminLoginAttempt_ipAddress_attemptedAt_idx_b880605b',
        columns: ['ipAddress', 'attemptedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminSession',
        index: 'adminSession_adminUserId_idx_0ce093a3',
        columns: ['adminUserId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminSession',
        index: 'adminSession_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'adminUser',
        index: 'adminUser_role_idx_2c1ddf83',
        columns: ['role'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'adminAuditLog',
        foreignKey: {
          name: 'adminAuditLog_adminUserId_fkey',
          columns: ['adminUserId'],
          references: { schema: 'public', table: 'adminUser', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'adminSession',
        foreignKey: {
          name: 'adminSession_adminUserId_fkey',
          columns: ['adminUserId'],
          references: { schema: 'public', table: 'adminUser', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
