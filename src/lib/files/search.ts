import type { FileCategory } from '@/lib/storage/types';

export type FileSearchFilters = {
  query?: string;
  category?: FileCategory;
  starred?: boolean;
  secure?: boolean;
  uploadedAfter?: string;
  uploadedBefore?: string;
  minSizeBytes?: bigint;
  maxSizeBytes?: bigint;
  sort?: 'date' | 'name' | 'size' | 'accessed';
};

const SIZE_WORDS: Record<string, bigint> = {
  kb: 1024n,
  mb: 1024n * 1024n,
  gb: 1024n * 1024n * 1024n,
};

export function parseNaturalLanguageFileQuery(input: string): Partial<FileSearchFilters> {
  const text = input.trim().toLowerCase();
  if (!text) {
    return {};
  }

  const filters: Partial<FileSearchFilters> = {};

  if (/\bsecure\b/.test(text) || /\bencrypted\b/.test(text)) {
    filters.secure = true;
  }
  if (/\bstarred\b/.test(text)) {
    filters.starred = true;
  }
  if (/\b(video|videos)\b/.test(text)) {
    filters.category = 'VIDEOS';
  } else if (/\b(image|images|photo|photos)\b/.test(text)) {
    filters.category = 'IMAGES';
  } else if (/\b(document|documents|pdf|pdfs)\b/.test(text)) {
    filters.category = 'DOCUMENTS';
  }

  if (/\blarge\b/.test(text)) {
    filters.minSizeBytes = 100n * 1024n * 1024n;
  }

  if (/today/.test(text)) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    filters.uploadedAfter = start.toISOString();
  }

  const sizeMatch = text.match(/\b(\d+)\s*(kb|mb|gb)\b/);
  if (sizeMatch) {
    const amount = BigInt(sizeMatch[1]!);
    const unit = SIZE_WORDS[sizeMatch[2]!] ?? 1n;
    filters.minSizeBytes = amount * unit;
  }

  const plainQuery = text
    .replace(/\b(secure|encrypted|starred|large|today|video|videos|image|images|photo|photos|document|documents|pdf|pdfs)\b/g, '')
    .replace(/\b\d+\s*(kb|mb|gb)\b/g, '')
    .trim();

  if (plainQuery) {
    filters.query = plainQuery;
  }

  return filters;
}

export function mergeFileSearchFilters(
  params: URLSearchParams,
): FileSearchFilters {
  const natural = params.get('q') ?? params.get('nl') ?? '';
  const parsed = parseNaturalLanguageFileQuery(natural);

  return {
    ...parsed,
    query: params.get('q')?.trim() || parsed.query,
    category: (params.get('category') as FileCategory | null) ?? parsed.category,
    starred: params.get('starred') === '1' ? true : parsed.starred,
    secure: params.get('secure') === '1' ? true : parsed.secure,
    sort: (params.get('sort') as FileSearchFilters['sort']) ?? 'date',
  };
}

type SearchableFile = {
  id?: string;
  name: string;
  category: FileCategory;
  starred: boolean;
  securityMode: 'NORMAL' | 'SECURE';
  size: string;
  createdAt: string;
};

export function applyFileSearchFilters<T extends SearchableFile>(
  files: T[],
  filters: FileSearchFilters,
): T[] {
  let result = files;

  if (filters.category) {
    result = result.filter((file) => file.category === filters.category);
  }
  if (filters.starred) {
    result = result.filter((file) => file.starred);
  }
  if (filters.secure) {
    result = result.filter((file) => file.securityMode === 'SECURE');
  }
  if (filters.minSizeBytes !== undefined) {
    result = result.filter((file) => BigInt(file.size) >= filters.minSizeBytes!);
  }
  if (filters.maxSizeBytes !== undefined) {
    result = result.filter((file) => BigInt(file.size) <= filters.maxSizeBytes!);
  }
  if (filters.uploadedAfter) {
    const after = new Date(filters.uploadedAfter).getTime();
    result = result.filter((file) => new Date(file.createdAt).getTime() >= after);
  }
  if (filters.uploadedBefore) {
    const before = new Date(filters.uploadedBefore).getTime();
    result = result.filter((file) => new Date(file.createdAt).getTime() <= before);
  }
  if (filters.query) {
    const query = filters.query.toLowerCase();
    result = result.filter((file) => file.name.toLowerCase().includes(query));
  }

  if (filters.sort === 'name') {
    result = [...result].sort((a, b) => a.name.localeCompare(b.name));
  } else if (filters.sort === 'size') {
    result = [...result].sort((a, b) => Number(BigInt(b.size) - BigInt(a.size)));
  } else {
    result = [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  return result;
}
