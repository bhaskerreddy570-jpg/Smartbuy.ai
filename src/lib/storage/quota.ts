export function exceedsStorageQuota(
  storageUsed: bigint,
  additionalBytes: bigint,
  storageQuota: bigint,
): boolean {
  return storageUsed + additionalBytes > storageQuota;
}

export function storageUsedAfterUpload(
  storageUsed: bigint,
  uploadedBytes: bigint,
): bigint {
  return storageUsed + uploadedBytes;
}
