import { orm } from '@/lib/db';
import type { FileCategory } from '@/lib/storage/types';

const fileSelect = [
  'id',
  'name',
  'originalName',
  'size',
  'mimeType',
  'category',
  'storageKey',
  'storageProvider',
  'storageNamespace',
  'starred',
  'securityMode',
  'encryptionFormatVersion',
  'encryptionAlgorithm',
  'encryptionKdf',
  'encryptionSalt',
  'encryptionIv',
  'plaintextSize',
  'createdAt',
  'deletedAt',
] as const;

export async function getOwnedFile(userId: string, fileId: string) {
  return orm.File.where({
    id: fileId,
    userId,
    deletedAt: null,
    status: 'READY',
  }).first();
}

export async function getOwnedDeletedFile(userId: string, fileId: string) {
  return orm.File.where({
    id: fileId,
    userId,
    status: 'READY',
  })
    .select(...fileSelect)
    .first()
    .then((file) => (file?.deletedAt ? file : null));
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

  return query.select(...fileSelect).all();
}

export async function listStarredFiles(userId: string) {
  return orm.File.where({
    userId,
    deletedAt: null,
    status: 'READY',
    starred: true,
  })
    .select(...fileSelect)
    .all();
}

export async function listDeletedFiles(userId: string) {
  return orm.File.where({
    userId,
    status: 'READY',
  })
    .select(...fileSelect)
    .all()
    .then((files) => files.filter((file) => file.deletedAt !== null));
}

export async function softDeleteOwnedFile(userId: string, fileId: string) {
  const file = await getOwnedFile(userId, fileId);
  if (!file) {
    return null;
  }

  await orm.File.where({ id: file.id, userId }).update({
    deletedAt: new Date().toISOString(),
    starred: false,
  });

  return file;
}

export async function restoreOwnedFile(userId: string, fileId: string) {
  const file = await getOwnedDeletedFile(userId, fileId);
  if (!file) {
    return null;
  }

  await orm.File.where({ id: file.id, userId }).update({
    deletedAt: null,
  });

  return file;
}

export async function setOwnedFileStarred(
  userId: string,
  fileId: string,
  starred: boolean,
) {
  const file = await getOwnedFile(userId, fileId);
  if (!file) {
    return null;
  }

  await orm.File.where({ id: file.id, userId }).update({ starred });
  return { ...file, starred };
}
