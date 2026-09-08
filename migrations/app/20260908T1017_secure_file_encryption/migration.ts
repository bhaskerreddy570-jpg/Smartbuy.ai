#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/158fc4958e4bb04acc34082979986e104eb06b410aec8585b1c5d119bb977da1/contract';
import startContract from '../../snapshots/158fc4958e4bb04acc34082979986e104eb06b410aec8585b1c5d119bb977da1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7f68a8f9545e91ec88f435a1f29f2322cf5b108b8ff775f14ed8aac73f7e15b1/contract';
import endContract from '../../snapshots/7f68a8f9545e91ec88f435a1f29f2322cf5b108b8ff775f14ed8aac73f7e15b1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionAlgorithm', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionFormatVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionIv', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionKdf', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('encryptionSalt', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('plaintextSize', 'int8', { codecRef: { codecId: 'pg/int8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('securityMode', 'text', {
          notNull: true,
          default: lit('NORMAL'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'file',
        constraint: 'file_securityMode_check_78f49108',
        expression: "\"securityMode\" IN ('NORMAL', 'SECURE')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
