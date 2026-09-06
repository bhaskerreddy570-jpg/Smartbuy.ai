import { NextResponse } from 'next/server';
import { requireAdminRole } from '@/lib/admin/authorization';
import { orm } from '@/lib/db';

export async function GET(request: Request) {
  const { error } = await requireAdminRole(request);
  if (error) {
    return error;
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 100);

  const logs = await orm.AdminAuditLog.select(
    'id',
    'adminUserId',
    'action',
    'targetType',
    'targetId',
    'metadata',
    'ipAddress',
    'createdAt',
  ).all();

  const sorted = logs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);

  return NextResponse.json({ logs: sorted });
}
