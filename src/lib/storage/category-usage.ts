import { Pool } from 'pg';
import { FILE_CATEGORIES, type FileCategory } from '@/lib/storage/types';
import { resolveDatabaseUrl } from '@/lib/server-env';
import { formatBytes } from '@/lib/storage/validation';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = resolveDatabaseUrl();
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export type CategoryUsageSummary = {
  category: FileCategory;
  label: string;
  bytesUsed: bigint;
  bytesLabel: string;
  fileCount: number;
};

export type CustomerStorageUsageSummary = {
  userId: string;
  totalBytesUsed: bigint;
  totalLabel: string;
  categories: CategoryUsageSummary[];
};

const CATEGORY_LABELS: Record<FileCategory, string> = {
  CONTACTS: 'Contacts',
  IMAGES: 'Images',
  VIDEOS: 'Videos',
  DOCUMENTS: 'Documents',
  OTHER: 'Other Files',
};

export async function getCustomerStorageUsageByCategory(
  userId: string,
): Promise<CustomerStorageUsageSummary | null> {
  const result = await getPool().query<{
    category: FileCategory;
    bytesUsed: string;
    fileCount: string;
  }>(
    `SELECT
       category,
       COALESCE(SUM(size), 0)::text AS "bytesUsed",
       COUNT(*)::text AS "fileCount"
     FROM file
     WHERE "userId" = $1
       AND "deletedAt" IS NULL
       AND status = 'READY'
     GROUP BY category`,
    [userId],
  );

  if (result.rowCount === 0) {
    const userExists = await getPool().query(
      'SELECT id FROM "user" WHERE id = $1',
      [userId],
    );
    if (userExists.rowCount !== 1) {
      return null;
    }
  }

  const usageByCategory = new Map<FileCategory, { bytesUsed: bigint; fileCount: number }>();
  for (const category of FILE_CATEGORIES) {
    usageByCategory.set(category, { bytesUsed: BigInt(0), fileCount: 0 });
  }

  for (const row of result.rows) {
    usageByCategory.set(row.category, {
      bytesUsed: BigInt(row.bytesUsed),
      fileCount: Number(row.fileCount),
    });
  }

  let totalBytesUsed = BigInt(0);
  const categories = FILE_CATEGORIES.map((category) => {
    const usage = usageByCategory.get(category)!;
    totalBytesUsed += usage.bytesUsed;
    return {
      category,
      label: CATEGORY_LABELS[category],
      bytesUsed: usage.bytesUsed,
      bytesLabel: formatBytes(usage.bytesUsed),
      fileCount: usage.fileCount,
    };
  });

  return {
    userId,
    totalBytesUsed,
    totalLabel: formatBytes(totalBytesUsed),
    categories,
  };
}
