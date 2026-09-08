import { FILE_CATEGORIES, type FileCategory } from '@/lib/storage/types';

const CATEGORY_LABELS: Record<FileCategory, string> = {
  CONTACTS: 'Contacts',
  IMAGES: 'Images',
  VIDEOS: 'Videos',
  DOCUMENTS: 'Documents',
  OTHER: 'Other Files',
};

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.avi',
  '.mkv',
  '.webm',
  '.m4v',
  '.mpeg',
  '.mpg',
]);

const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.rtf',
  '.csv',
  '.md',
  '.odt',
  '.ods',
  '.odp',
]);

const CONTACT_EXTENSIONS = new Set(['.vcf', '.vcard']);

function extractExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === normalized.length - 1) {
    return '';
  }
  return normalized.slice(lastDot);
}

export function isFileCategory(value: string): value is FileCategory {
  return (FILE_CATEGORIES as readonly string[]).includes(value);
}

export function getCategoryLabel(category: FileCategory): string {
  return CATEGORY_LABELS[category];
}

export function detectFileCategory(params: {
  fileName: string;
  mimeType: string;
}): FileCategory {
  const mimeType = params.mimeType.trim().toLowerCase();
  const extension = extractExtension(params.fileName);

  if (mimeType.startsWith('image/') || IMAGE_EXTENSIONS.has(extension)) {
    return 'IMAGES';
  }

  if (mimeType.startsWith('video/') || VIDEO_EXTENSIONS.has(extension)) {
    return 'VIDEOS';
  }

  if (CONTACT_EXTENSIONS.has(extension) || mimeType.includes('vcard')) {
    return 'CONTACTS';
  }

  if (
    mimeType.startsWith('text/') ||
    mimeType === 'application/pdf' ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    DOCUMENT_EXTENSIONS.has(extension)
  ) {
    return 'DOCUMENTS';
  }

  return 'OTHER';
}

export function resolveFileCategory(params: {
  fileName: string;
  mimeType: string;
  requestedCategory?: string;
}): FileCategory {
  void params.requestedCategory;
  return detectFileCategory(params);
}

export function categoryPathSegment(category: FileCategory): string {
  return category.toLowerCase();
}
