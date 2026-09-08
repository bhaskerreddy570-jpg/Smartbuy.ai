import { buildStorageKey } from '@/lib/storage/keys';
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  getObjectMetadata,
} from '@/lib/storage/s3';
import type {
  CreateDownloadParams,
  ObjectStoreProvider,
  PrepareUploadParams,
  PrepareUploadResult,
  StorageObjectRef,
  StorageProviderId,
} from '@/lib/storage/types';

export class S3ObjectStoreProvider implements ObjectStoreProvider {
  readonly providerId: StorageProviderId = 'S3';

  async prepareUpload(params: PrepareUploadParams): Promise<PrepareUploadResult> {
    const key = buildStorageKey({
      userId: params.userId,
      objectId: params.objectId,
      category: params.category,
    });

    const uploadUrl = await createUploadUrl({
      storageKey: key,
      size: params.size,
    });

    return {
      uploadUrl,
      objectRef: {
        provider: this.providerId,
        namespace: params.namespace ?? 'default',
        key,
      },
    };
  }

  async createDownloadUrl(params: CreateDownloadParams): Promise<string> {
    return createDownloadUrl({
      storageKey: params.objectRef.key,
      fileName: params.fileName,
    });
  }

  async headObject(objectRef: StorageObjectRef) {
    const metadata = await getObjectMetadata(objectRef.key);
    return {
      size: metadata.size,
      contentType: metadata.contentType,
    };
  }

  async deleteObject(objectRef: StorageObjectRef): Promise<void> {
    await deleteObject(objectRef.key);
  }

  async objectExists(objectRef: StorageObjectRef): Promise<boolean> {
    try {
      await getObjectMetadata(objectRef.key);
      return true;
    } catch {
      return false;
    }
  }
}

export const s3ObjectStoreProvider = new S3ObjectStoreProvider();
