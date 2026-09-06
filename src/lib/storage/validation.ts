const BLOCKED_MIME_PREFIXES = ['application/x-msdownload', 'application/x-dosexec'];

export function sanitizeFilename(filename: string): string {
  const baseName = filename.split(/[/\\]/).pop()?.trim() ?? 'file';
  const sanitized = baseName.replace(/[^\w.\- ()]/g, '_').slice(0, 255);
  return sanitized.length > 0 ? sanitized : 'file';
}

export function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized || normalized === 'application/octet-stream') {
    return true;
  }

  return !BLOCKED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

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
