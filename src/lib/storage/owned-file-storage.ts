import { assertStorageKeyOwnership } from '@/lib/storage/keys';
import {
  getOwnedDeletedFile,
  getOwnedFile,
  getOwnedFileIncludingPending,
} from '@/lib/storage/files';
import { toStorageObjectRef } from '@/lib/storage/storage-service';
import type { StorageObjectRef } from '@/lib/storage/types';

type ReadyFile = NonNullable<Awaited<ReturnType<typeof getOwnedFile>>>;
type PendingFile = NonNullable<
  Awaited<ReturnType<typeof getOwnedFileIncludingPending>>
>;
type DeletedFile = NonNullable<Awaited<ReturnType<typeof getOwnedDeletedFile>>>;

type ResolvedOwnedFileStorage<TFile> = {
  file: TFile;
  objectRef: StorageObjectRef;
};

export async function resolveOwnedFileStorage(params: {
  userId: string;
  fileId: string;
  mode: 'ready';
}): Promise<ResolvedOwnedFileStorage<ReadyFile> | null>;
export async function resolveOwnedFileStorage(params: {
  userId: string;
  fileId: string;
  mode: 'pending';
}): Promise<ResolvedOwnedFileStorage<PendingFile> | null>;
export async function resolveOwnedFileStorage(params: {
  userId: string;
  fileId: string;
  mode: 'deleted';
}): Promise<ResolvedOwnedFileStorage<DeletedFile> | null>;
export async function resolveOwnedFileStorage(params: {
  userId: string;
  fileId: string;
  mode: 'ready' | 'pending' | 'deleted';
}): Promise<ResolvedOwnedFileStorage<
  ReadyFile | PendingFile | DeletedFile
> | null> {
  const file =
    params.mode === 'pending'
      ? await getOwnedFileIncludingPending(params.userId, params.fileId)
      : params.mode === 'deleted'
        ? await getOwnedDeletedFile(params.userId, params.fileId)
        : await getOwnedFile(params.userId, params.fileId);

  if (
    !file ||
    !assertStorageKeyOwnership({
      storageKey: file.storageKey,
      userId: params.userId,
      category: file.category,
    })
  ) {
    return null;
  }

  return {
    file,
    objectRef: toStorageObjectRef(file),
  };
}
