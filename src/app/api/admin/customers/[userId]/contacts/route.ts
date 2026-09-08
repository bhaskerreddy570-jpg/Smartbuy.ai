import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/admin/authorization';
import { notFoundResponse } from '@/lib/api/auth';
import { orm } from '@/lib/db';
import {
  getContactBackupSummary,
  listCustomerDevices,
} from '@/lib/contacts/sync-service';

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request, { params }: RouteParams) {
  const { error } = await requireAdminSession(request);
  if (error) {
    return error;
  }

  const { userId } = await params;
  const user = await orm.User.where({ id: userId }).select('id', 'email').first();
  if (!user) {
    return notFoundResponse();
  }

  const [summary, devices] = await Promise.all([
    getContactBackupSummary(userId),
    listCustomerDevices(userId),
  ]);

  return NextResponse.json({
    customerId: user.id,
    email: user.email,
    summary,
    devices: devices.map((device) => ({
      id: device.id,
      platform: device.platform,
      displayName: device.displayName,
      automaticBackupEnabled: device.automaticBackupEnabled,
      lastSyncAt: device.lastSyncAt,
      lastSyncStatus: device.lastSyncStatus,
      revokedAt: device.revokedAt,
    })),
  });
}
