#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/c867c19b707482746d43885b3edc5e9ac98d6aeb2181107b422294860795b9f7/contract';
import startContract from '../../snapshots/c867c19b707482746d43885b3edc5e9ac98d6aeb2181107b422294860795b9f7/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ddd72e69619b76a48ba676f09f315805ab0a18363438a67c3be680c6996bd7df/contract';
import endContract from '../../snapshots/ddd72e69619b76a48ba676f09f315805ab0a18363438a67c3be680c6996bd7df/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('category', 'text', {
          notNull: true,
          default: lit('OTHER'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('storageNamespace', 'text', {
          notNull: true,
          default: lit('default'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('storageProvider', 'text', {
          notNull: true,
          default: lit('S3'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'file',
        constraint: 'file_category_check_b60b453e',
        expression: "\"category\" IN ('CONTACTS', 'IMAGES', 'VIDEOS', 'DOCUMENTS', 'OTHER')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'file',
        constraint: 'file_storageProvider_check_9da2fab1',
        expression: '"storageProvider" IN (\'S3\')',
      }),
      this.createIndex({
        schema: 'public',
        table: 'file',
        index: 'file_userId_category_idx_6e270954',
        columns: ['userId', 'category'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'file',
        index: 'file_userId_category_status_idx_1c139799',
        columns: ['userId', 'category', 'status'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
