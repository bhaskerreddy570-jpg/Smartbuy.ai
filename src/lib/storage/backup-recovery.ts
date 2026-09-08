import type { FileCategory, StorageProviderId } from '@/lib/storage/types';

export type BackupScope =
  | { kind: 'customer'; userId: string }
  | { kind: 'category'; userId: string; category: FileCategory };

export type RestoreScope =
  | { kind: 'customer'; userId: string; targetNamespace?: string }
  | { kind: 'category'; userId: string; category: FileCategory; targetNamespace?: string };

export type BackupJobRequest = {
  scope: BackupScope;
  provider: StorageProviderId;
  namespace: string;
  requestedByAdminId: string;
};

export type RestoreJobRequest = {
  scope: RestoreScope;
  backupReference: string;
  provider: StorageProviderId;
  requestedByAdminId: string;
};

export type BackupJobResult = {
  status: 'not_implemented';
  message: string;
};

export type RestoreJobResult = {
  status: 'not_implemented';
  message: string;
};

export async function requestCustomerBackup(): Promise<BackupJobResult> {
  return {
    status: 'not_implemented',
    message:
      'Backup jobs are scoped per customer and will run against an isolated namespace without touching other customers.',
  };
}

export async function requestCustomerRestore(): Promise<RestoreJobResult> {
  return {
    status: 'not_implemented',
    message:
      'Restore jobs are scoped per customer or category and must not overwrite unrelated customer data.',
  };
}

export function buildCategoryRestoreGuard(params: {
  sourceUserId: string;
  targetUserId: string;
  sourceCategory: FileCategory;
  targetCategory: FileCategory;
}): { allowed: boolean; reason?: string } {
  if (params.sourceUserId !== params.targetUserId) {
    return {
      allowed: false,
      reason: 'Cross-customer restore is forbidden',
    };
  }

  if (params.sourceCategory !== params.targetCategory) {
    return {
      allowed: false,
      reason: 'Cross-category restore is forbidden',
    };
  }

  return { allowed: true };
}
