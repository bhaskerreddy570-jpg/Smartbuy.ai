import { orm } from '@/lib/db';
import type { FileCategory } from '@/lib/storage/types';

export async function getOwnedFile(userId: string, fileId: string) {
  return orm.File.where({
    id: fileId,
    userId,
    deletedAt: null,
    status: 'READY',
  }).first();
}

export async function getOwnedFileIncludingPending(
  userId: string,
  fileId: string,
) {
  return orm.File.where({
    id: fileId,
    userId,
    deletedAt: null,
  }).first();
}

export async function listReadyFiles(userId: string, category?: FileCategory) {
  const query = orm.File.where({
    userId,
    deletedAt: null,
    status: 'READY',
    ...(category ? { category } : {}),
  });

  return query
    .select(
      'id',
      'name',
      'originalName',
      'size',
      'mimeType',
      'category',
      'storageKey',
      'storageProvider',
      'storageNamespace',
      'createdAt',
    )
    .all();
}
