#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/27ef97615bdea45da4e7055103a711356a9aa1c0f861ae0e06580657f2543f65/contract';
import endContract from '../../snapshots/27ef97615bdea45da4e7055103a711356a9aa1c0f861ae0e06580657f2543f65/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b354bca5f9be38e21931f11e3abbb89563de94cc3498ce519d0792286a79ff7a/contract';
import startContract from '../../snapshots/b354bca5f9be38e21931f11e3abbb89563de94cc3498ce519d0792286a79ff7a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'devicePairingSession',
        columns: [
          col('codeHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('consumedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deviceId', 'uuid', { codecRef: { codecId: 'pg/uuid@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('userId', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'devicePairingSession',
        index: 'devicePairingSession_deviceId_idx_a7d461e8',
        columns: ['deviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'devicePairingSession',
        index: 'devicePairingSession_expiresAt_idx_6b6b8c10',
        columns: ['expiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'devicePairingSession',
        index: 'devicePairingSession_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'devicePairingSession',
        foreignKey: {
          name: 'devicePairingSession_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'devicePairingSession',
        foreignKey: {
          name: 'devicePairingSession_deviceId_fkey',
          columns: ['deviceId'],
          references: { schema: 'public', table: 'customerDevice', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
