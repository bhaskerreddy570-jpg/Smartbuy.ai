#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7f68a8f9545e91ec88f435a1f29f2322cf5b108b8ff775f14ed8aac73f7e15b1/contract';
import startContract from '../../snapshots/7f68a8f9545e91ec88f435a1f29f2322cf5b108b8ff775f14ed8aac73f7e15b1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b354bca5f9be38e21931f11e3abbb89563de94cc3498ce519d0792286a79ff7a/contract';
import endContract from '../../snapshots/b354bca5f9be38e21931f11e3abbb89563de94cc3498ce519d0792286a79ff7a/contract.json' with { type: 'json' };
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
      this.dropCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_50774247',
      }),
      this.createTable({
        schema: 'public',
        table: 'cloudContact',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('displayName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('payloadBytes', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('payloadJson', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('securityMode', 'text', {
            notNull: true,
            default: lit('NORMAL'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('syncVersion', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'cloudContact_securityMode_check_78f49108',
            "\"securityMode\" IN ('NORMAL', 'SECURE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'contactBackupSettings',
        columns: [
          col('automaticBackupEnabled', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('contactCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('contactStorageBytes', 'int8', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/int8@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('lastSuccessfulBackupAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('lastSyncError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('lastSyncStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('syncCursor', 'int8', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/int8@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['userId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'contactSyncConflict',
        columns: [
          col('cloudContactId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('cloudPayloadJson', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('devicePayloadJson', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('resolution', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('resolvedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'contactSyncConflict_resolution_check_4feb6906',
            "\"resolution\" IN ('KEEP_DEVICE', 'KEEP_CLOUD', 'MERGE', 'DEFER')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'customerDevice',
        columns: [
          col('appVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('automaticBackupEnabled', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastSeenAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lastSyncAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('lastSyncStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('platform', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'customerDevice_platform_check_fb66222c',
            "\"platform\" IN ('ANDROID', 'IOS')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'customerDeviceToken',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'deviceContactMapping',
        columns: [
          col('cloudContactId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('lastKnownVersion', 'int8', { notNull: true, codecRef: { codecId: 'pg/int8@1' } }),
          col('lastLocalModified', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('localContactId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('syncState', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'deviceContactMapping_syncState_check_77a27c68',
            "\"syncState\" IN ('SYNCED', 'PENDING', 'CONFLICT', 'PAUSED')",
          ),
        ],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_b4f9cc13',
        expression:
          "\"action\" IN ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED', 'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED', 'STORAGE_LIMIT_CHANGED', 'MAX_FILE_SIZE_CHANGED', 'BANDWIDTH_LIMIT_CHANGED', 'CUSTOMER_PLAN_CHANGED', 'CUSTOMER_LOCKED', 'CUSTOMER_UNLOCKED', 'CUSTOMER_RECOVERY', 'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED', 'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED', 'CONTACT_BACKUP_VIEWED', 'MOBILE_DEVICE_REVOKED')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'customerDeviceToken',
        constraint: 'customerDeviceToken_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'deviceContactMapping',
        constraint: 'deviceContactMapping_deviceId_localContactId_key',
        columns: ['deviceId', 'localContactId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cloudContact',
        index: 'cloudContact_userId_deletedAt_idx_88e5d6f2',
        columns: ['userId', 'deletedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cloudContact',
        index: 'cloudContact_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cloudContact',
        index: 'cloudContact_userId_syncVersion_idx_c2466aef',
        columns: ['userId', 'syncVersion'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contactSyncConflict',
        index: 'contactSyncConflict_cloudContactId_idx_1c3a1cca',
        columns: ['cloudContactId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contactSyncConflict',
        index: 'contactSyncConflict_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'contactSyncConflict',
        index: 'contactSyncConflict_userId_resolvedAt_idx_1ad3b991',
        columns: ['userId', 'resolvedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerDevice',
        index: 'customerDevice_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerDevice',
        index: 'customerDevice_userId_revokedAt_idx_eae4cbef',
        columns: ['userId', 'revokedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerDeviceToken',
        index: 'customerDeviceToken_deviceId_idx_a7d461e8',
        columns: ['deviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'customerDeviceToken',
        index: 'customerDeviceToken_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deviceContactMapping',
        index: 'deviceContactMapping_cloudContactId_idx_1c3a1cca',
        columns: ['cloudContactId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'deviceContactMapping',
        index: 'deviceContactMapping_deviceId_idx_a7d461e8',
        columns: ['deviceId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cloudContact',
        foreignKey: {
          name: 'cloudContact_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contactBackupSettings',
        foreignKey: {
          name: 'contactBackupSettings_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'contactSyncConflict',
        foreignKey: {
          name: 'contactSyncConflict_cloudContactId_fkey',
          columns: ['cloudContactId'],
          references: { schema: 'public', table: 'cloudContact', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customerDevice',
        foreignKey: {
          name: 'customerDevice_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'customerDeviceToken',
        foreignKey: {
          name: 'customerDeviceToken_deviceId_fkey',
          columns: ['deviceId'],
          references: { schema: 'public', table: 'customerDevice', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deviceContactMapping',
        foreignKey: {
          name: 'deviceContactMapping_deviceId_fkey',
          columns: ['deviceId'],
          references: { schema: 'public', table: 'customerDevice', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'deviceContactMapping',
        foreignKey: {
          name: 'deviceContactMapping_cloudContactId_fkey',
          columns: ['cloudContactId'],
          references: { schema: 'public', table: 'cloudContact', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
