import { orm } from '@/lib/db';

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

export async function listReadyFiles(userId: string) {
  return orm.File.where({
    userId,
    deletedAt: null,
    status: 'READY',
  })
    .select('id', 'name', 'originalName', 'size', 'mimeType', 'createdAt')
    .all();
}
