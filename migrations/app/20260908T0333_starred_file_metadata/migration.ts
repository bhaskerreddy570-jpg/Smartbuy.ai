#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/a1a6cc5551c104dbac2f0d1c892162a3b1d60ebb23f87f95b2ab2949637f9543/contract';
import endContract from '../../snapshots/a1a6cc5551c104dbac2f0d1c892162a3b1d60ebb23f87f95b2ab2949637f9543/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c981e8ad0bad900bf4c3f162dfcb770ec981bb93a2f434949ac658f92ce6241c/contract';
import startContract from '../../snapshots/c981e8ad0bad900bf4c3f162dfcb770ec981bb93a2f434949ac658f92ce6241c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'file',
        column: col('starred', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'file',
        index: 'file_userId_starred_idx_57631854',
        columns: ['userId', 'starred'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
