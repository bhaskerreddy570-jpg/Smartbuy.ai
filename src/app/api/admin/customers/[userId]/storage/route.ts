import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminNotFoundResponse,
  requireAdminRole,
} from '@/lib/admin/authorization';
import { getCustomerStorageUsageByCategory } from '@/lib/storage/category-usage';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { error } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) {
    return adminNotFoundResponse();
  }

  try {
    const usage = await getCustomerStorageUsageByCategory(userId);
    if (!usage) {
      return adminNotFoundResponse();
    }

    return NextResponse.json({
      userId: usage.userId,
      storageUsed: usage.totalBytesUsed.toString(),
      storageUsedLabel: usage.totalLabel,
      categories: usage.categories.map((category) => ({
        category: category.category,
        label: category.label,
        bytesUsed: category.bytesUsed.toString(),
        bytesLabel: category.bytesLabel,
        fileCount: category.fileCount,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Unable to load storage usage' }, { status: 500 });
  }
}
