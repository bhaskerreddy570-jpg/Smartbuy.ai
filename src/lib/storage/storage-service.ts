import { s3ObjectStoreProvider } from '@/lib/storage/providers/s3-object-store';
import type {
  CreateDownloadParams,
  ObjectStoreProvider,
  PrepareUploadParams,
  PrepareUploadResult,
  PutObjectParams,
  StorageObjectRef,
  StorageProviderId,
} from '@/lib/storage/types';

const providers: Record<StorageProviderId, ObjectStoreProvider> = {
  S3: s3ObjectStoreProvider,
};

export function getObjectStoreProvider(
  providerId: StorageProviderId = 'S3',
): ObjectStoreProvider {
  const provider = providers[providerId];
  if (!provider) {
    throw new Error(`Unsupported storage provider: ${providerId}`);
  }
  return provider;
}

export class StorageService {
  prepareUpload(params: PrepareUploadParams): Promise<PrepareUploadResult> {
    return getObjectStoreProvider().prepareUpload(params);
  }

  putObject(params: PutObjectParams): Promise<void> {
    return getObjectStoreProvider(params.objectRef.provider).putObject(params);
  }

  createDownloadUrl(params: CreateDownloadParams): Promise<string> {
    return getObjectStoreProvider(params.objectRef.provider).createDownloadUrl(
      params,
    );
  }

  headObject(objectRef: StorageObjectRef) {
    return getObjectStoreProvider(objectRef.provider).headObject(objectRef);
  }

  deleteObject(objectRef: StorageObjectRef): Promise<void> {
    return getObjectStoreProvider(objectRef.provider).deleteObject(objectRef);
  }

  objectExists(objectRef: StorageObjectRef): Promise<boolean> {
    return getObjectStoreProvider(objectRef.provider).objectExists(objectRef);
  }
}

let storageService: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = new StorageService();
  }
  return storageService;
}

export function toStorageObjectRef(file: {
  storageKey: string;
  storageProvider: StorageProviderId | string;
  storageNamespace: string;
}): StorageObjectRef {
  return {
    provider: file.storageProvider as StorageProviderId,
    namespace: file.storageNamespace,
    key: file.storageKey,
  };
}
