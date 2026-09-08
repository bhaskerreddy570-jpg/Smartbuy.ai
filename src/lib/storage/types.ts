export const FILE_CATEGORIES = [
  'CONTACTS',
  'IMAGES',
  'VIDEOS',
  'DOCUMENTS',
  'OTHER',
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const STORAGE_PROVIDERS = ['S3'] as const;

export type StorageProviderId = (typeof STORAGE_PROVIDERS)[number];

export const DEFAULT_STORAGE_NAMESPACE = 'default';

export type StorageObjectRef = {
  provider: StorageProviderId;
  namespace: string;
  key: string;
};

export type StoredObjectMetadata = {
  size: bigint;
  contentType?: string;
};

export type PrepareUploadParams = {
  userId: string;
  category: FileCategory;
  objectId: string;
  size: bigint;
  namespace?: string;
};

export type PrepareUploadResult = {
  uploadUrl: string;
  objectRef: StorageObjectRef;
};

export type CreateDownloadParams = {
  objectRef: StorageObjectRef;
  fileName: string;
};

export type PutObjectParams = {
  objectRef: StorageObjectRef;
  body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
  size: bigint;
};

export type ObjectStoreProvider = {
  readonly providerId: StorageProviderId;
  prepareUpload(params: PrepareUploadParams): Promise<PrepareUploadResult>;
  putObject(params: PutObjectParams): Promise<void>;
  createDownloadUrl(params: CreateDownloadParams): Promise<string>;
  headObject(objectRef: StorageObjectRef): Promise<StoredObjectMetadata>;
  deleteObject(objectRef: StorageObjectRef): Promise<void>;
  objectExists(objectRef: StorageObjectRef): Promise<boolean>;
};
