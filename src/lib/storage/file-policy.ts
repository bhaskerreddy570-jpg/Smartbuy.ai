/**
 * Default blocked executable/script extensions for general-purpose storage.
 * Extend via BLOCKED_FILE_EXTENSIONS in environment (comma-separated, with dots).
 * Future phases may add antivirus scanning without changing this module's shape.
 */
export const DEFAULT_BLOCKED_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.scr',
  '.msi',
  '.ps1',
  '.vbs',
  '.vbe',
  '.wsf',
  '.wsh',
  '.hta',
] as const;

/** Secondary signal only — not a MIME whitelist. */
const BLOCKED_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-dosexec',
  'application/vnd.microsoft.portable-executable',
  'application/x-msdos-program',
  'application/x-executable',
]);

export type FilenameValidationResult =
  | {
      ok: true;
      sanitizedName: string;
      extension: string | null;
    }
  | {
      ok: false;
      reason: string;
    };

function getConfiguredBlockedExtensions(): Set<string> {
  const blocked = new Set<string>(
    DEFAULT_BLOCKED_EXTENSIONS.map((extension) => extension.toLowerCase()),
  );

  const configured = process.env.BLOCKED_FILE_EXTENSIONS?.trim();
  if (!configured) {
    return blocked;
  }

  for (const entry of configured.split(',')) {
    const normalized = normalizeExtension(entry);
    if (normalized) {
      blocked.add(normalized);
    }
  }

  return blocked;
}

function normalizeExtension(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function extractExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return null;
  }

  return filename.slice(lastDot).toLowerCase();
}

function containsPathTraversal(filename: string): boolean {
  return (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0')
  );
}

function containsBlockedExtensionPart(
  filename: string,
  blockedExtensions: Set<string>,
): boolean {
  const lower = filename.toLowerCase();
  const parts = lower.split('.');

  if (parts.length <= 1) {
    return false;
  }

  for (let index = 1; index < parts.length; index += 1) {
    const candidate = `.${parts[index]}`;
    if (blockedExtensions.has(candidate)) {
      return true;
    }
  }

  return false;
}

export function sanitizeFilename(filename: string): string {
  const withoutNullBytes = filename.replace(/\0/g, '');
  const baseName = withoutNullBytes.split(/[/\\]/).pop()?.trim() ?? 'file';
  const sanitized = baseName.replace(/[^\w.\- ()]/g, '_').slice(0, 255);
  return sanitized.length > 0 ? sanitized : 'file';
}

export function normalizeStoredMimeType(mimeType: string | undefined | null): string {
  const normalized = mimeType?.trim().toLowerCase() ?? '';
  if (!normalized || normalized.length > 255) {
    return 'application/octet-stream';
  }

  return normalized;
}

export function isBlockedMimeType(mimeType: string | undefined | null): boolean {
  const normalized = normalizeStoredMimeType(mimeType);
  return BLOCKED_MIME_TYPES.has(normalized);
}

export function validateUploadFilename(rawFilename: string): FilenameValidationResult {
  if (!rawFilename || typeof rawFilename !== 'string') {
    return { ok: false, reason: 'Filename is required' };
  }

  if (rawFilename.length > 512) {
    return { ok: false, reason: 'Filename is too long' };
  }

  if (containsPathTraversal(rawFilename)) {
    return { ok: false, reason: 'Filename is not allowed' };
  }

  const sanitizedName = sanitizeFilename(rawFilename);
  const blockedExtensions = getConfiguredBlockedExtensions();

  if (containsBlockedExtensionPart(sanitizedName, blockedExtensions)) {
    return { ok: false, reason: 'Executable file types are not allowed' };
  }

  const extension = extractExtension(sanitizedName);
  if (extension && blockedExtensions.has(extension)) {
    return { ok: false, reason: 'Executable file types are not allowed' };
  }

  return {
    ok: true,
    sanitizedName,
    extension,
  };
}

export function validateUploadRequest(params: {
  fileName: string;
  mimeType: string;
}): FilenameValidationResult {
  const filenameResult = validateUploadFilename(params.fileName);
  if (!filenameResult.ok) {
    return filenameResult;
  }

  if (isBlockedMimeType(params.mimeType)) {
    return { ok: false, reason: 'Executable file types are not allowed' };
  }

  return filenameResult;
}

export function buildSafeContentDisposition(filename: string): string {
  const sanitized = sanitizeFilename(filename).replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(sanitized).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}
