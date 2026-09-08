import { NextResponse } from 'next/server';
import { requireAuthUser, notFoundResponse } from '@/lib/api/auth';
import {
  getContactBackupSummary,
  listActiveContacts,
  listCustomerDevices,
} from '@/lib/contacts/sync-service';
import { parseContactPayload } from '@/lib/contacts/payload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { error, user } = await requireAuthUser();
  if (error || !user) {
    return error!;
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? undefined;

  const [summary, devices, contacts] = await Promise.all([
    getContactBackupSummary(user.id),
    listCustomerDevices(user.id),
    listActiveContacts(user.id, query),
  ]);

  return NextResponse.json({
    summary,
    devices: devices.map((device) => ({
      id: device.id,
      platform: device.platform,
      displayName: device.displayName,
      automaticBackupEnabled: device.automaticBackupEnabled,
      lastSeenAt: device.lastSeenAt,
      lastSyncAt: device.lastSyncAt,
      lastSyncStatus: device.lastSyncStatus,
      revokedAt: device.revokedAt,
    })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      displayName: contact.displayName,
      payload: parseContactPayload(contact.payloadJson),
      syncVersion: contact.syncVersion.toString(),
      updatedAt: contact.updatedAt,
    })),
  });
}

export async function POST() {
  return notFoundResponse();
}
