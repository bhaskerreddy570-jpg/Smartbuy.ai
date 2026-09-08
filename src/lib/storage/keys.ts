import { categoryPathSegment } from '@/lib/storage/categories';
import type { FileCategory } from '@/lib/storage/types';

export const LEGACY_STORAGE_KEY_PREFIX = 'users/';

export type ParsedStorageKey =
  | {
      format: 'isolated';
      userId: string;
      category: FileCategory;
      objectId: string;
    }
  | {
      format: 'legacy';
      userId: string;
      objectId: string;
    };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function buildStorageKey(params: {
  userId: string;
  objectId: string;
  category: FileCategory;
}): string {
  return `customers/${params.userId}/${categoryPathSegment(params.category)}/${params.objectId}`;
}

export function buildLegacyStorageKey(userId: string, objectId: string): string {
  return `${LEGACY_STORAGE_KEY_PREFIX}${userId}/files/${objectId}`;
}

export function parseStorageKey(storageKey: string): ParsedStorageKey | null {
  const isolatedMatch = storageKey.match(
    /^customers\/([^/]+)\/(contacts|images|videos|documents|other)\/([^/]+)$/i,
  );
  if (isolatedMatch) {
    const [, userId, categorySegment, objectId] = isolatedMatch;
    if (!isUuid(userId) || !isUuid(objectId)) {
      return null;
    }

    const category = categorySegment.toUpperCase() as FileCategory;
    return {
      format: 'isolated',
      userId,
      category,
      objectId,
    };
  }

  const legacyMatch = storageKey.match(/^users\/([^/]+)\/files\/([^/]+)$/);
  if (legacyMatch) {
    const [, userId, objectId] = legacyMatch;
    if (!isUuid(userId) || !isUuid(objectId)) {
      return null;
    }

    return {
      format: 'legacy',
      userId,
      objectId,
    };
  }

  return null;
}

export function assertStorageKeyOwnership(params: {
  storageKey: string;
  userId: string;
  category?: FileCategory;
}): boolean {
  const parsed = parseStorageKey(params.storageKey);
  if (!parsed || parsed.userId !== params.userId) {
    return false;
  }

  if (parsed.format === 'isolated' && params.category) {
    return parsed.category === params.category;
  }

  return true;
}
