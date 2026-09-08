#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/40b7cdaa591efab9890af3062a4f1f912b4ab8ab0919518852391526c2a83492/contract';
import endContract from '../../snapshots/40b7cdaa591efab9890af3062a4f1f912b4ab8ab0919518852391526c2a83492/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c867c19b707482746d43885b3edc5e9ac98d6aeb2181107b422294860795b9f7/contract';
import startContract from '../../snapshots/c867c19b707482746d43885b3edc5e9ac98d6aeb2181107b422294860795b9f7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

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
        column: col('recoveryTokenExpiresAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'user',
        column: col('recoveryTokenHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_2242d3de',
        expression:
          "\"action\" IN ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED', 'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED', 'CUSTOMER_QUOTA_CHANGED', 'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED', 'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
