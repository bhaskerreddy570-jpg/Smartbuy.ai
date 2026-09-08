import { NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/mobile/require-mobile-auth';
import { listCustomerDevices } from '@/lib/contacts/sync-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { error, auth } = await requireMobileAuth(request);
  if (error || !auth) {
    return error!;
  }

  const devices = await listCustomerDevices(auth.userId);
  return NextResponse.json({
    devices: devices.map((device) => ({
      id: device.id,
      platform: device.platform,
      displayName: device.displayName,
      appVersion: device.appVersion,
      automaticBackupEnabled: device.automaticBackupEnabled,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      lastSyncStatus: device.lastSyncStatus,
      revokedAt: device.revokedAt,
      createdAt: device.createdAt,
      isCurrentDevice: device.id === auth.deviceId,
    })),
  });
}
