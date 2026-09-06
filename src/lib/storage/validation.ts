export {
  sanitizeFilename,
  validateUploadFilename,
  validateUploadRequest,
  buildSafeContentDisposition,
  normalizeStoredMimeType,
} from '@/lib/storage/file-policy';

export function formatBytes(bytes: bigint): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
