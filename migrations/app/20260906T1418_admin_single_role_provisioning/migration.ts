#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/14deadf22b4c9de216575140a62057f447894e32901f42af806487c11e449b10/contract';
import startContract from '../../snapshots/14deadf22b4c9de216575140a62057f447894e32901f42af806487c11e449b10/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c867c19b707482746d43885b3edc5e9ac98d6aeb2181107b422294860795b9f7/contract';
import endContract from '../../snapshots/c867c19b707482746d43885b3edc5e9ac98d6aeb2181107b422294860795b9f7/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_f1852307',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'adminUser',
        constraint: 'adminUser_role_check_f0aaa5a4',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'adminAuditLog',
        constraint: 'adminAuditLog_action_check_2c184a7c',
        expression:
          "\"action\" IN ('ADMIN_LOGIN_SUCCESS', 'ADMIN_LOGIN_FAILED', 'ADMIN_LOGOUT', 'ADMIN_SESSION_REVOKED', 'ADMIN_PASSWORD_CHANGED', 'CUSTOMER_ACCOUNT_LOCKED', 'CUSTOMER_ACCOUNT_UNLOCKED', 'RECOVERY_TOKEN_ISSUED', 'RECOVERY_TOKEN_USED', 'RECOVERY_REQUEST_DENIED', 'BACKUP_REQUESTED', 'DATA_RECOVERY_REQUESTED')",
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'adminUser',
        constraint: 'adminUser_role_check_d64e1afa',
        expression: '"role" IN (\'ADMIN\')',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
