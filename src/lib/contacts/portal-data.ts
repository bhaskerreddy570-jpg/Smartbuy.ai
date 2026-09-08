import { parseContactPayload } from '@/lib/contacts/payload';
import {
  getContactBackupSummary,
  listActiveContacts,
  listCustomerDevices,
} from '@/lib/contacts/sync-service';
import { isPortalImportDevice } from '@/lib/mobile/device-pairing';

export type ContactsPortalData = {
  summary: {
    automaticBackupEnabled: boolean;
    contactCount: number;
    contactStorageBytes: string;
    lastSuccessfulBackupAt: string | null;
    lastSyncStatus: string | null;
    lastSyncError: string | null;
  };
  devices: Array<{
    id: string;
    platform: 'ANDROID' | 'IOS';
    displayName: string;
    automaticBackupEnabled: boolean;
    lastSeenAt: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    revokedAt: string | null;
    createdAt: string;
  }>;
  contacts: Array<{
    id: string;
    displayName: string | null;
    payload: ReturnType<typeof parseContactPayload>;
    syncVersion: string;
    updatedAt: string;
  }>;
};

export async function loadContactsPortalData(
  userId: string,
  query?: string,
): Promise<ContactsPortalData> {
  const [summary, devices, contacts] = await Promise.all([
    getContactBackupSummary(userId),
    listCustomerDevices(userId),
    listActiveContacts(userId, query),
  ]);

  return {
    summary,
    devices: devices
      .filter((device) => !isPortalImportDevice(device.displayName))
      .map((device) => ({
        id: device.id,
        platform: device.platform as 'ANDROID' | 'IOS',
        displayName: device.displayName,
        automaticBackupEnabled: device.automaticBackupEnabled,
        lastSeenAt: device.lastSeenAt,
        lastSyncAt: device.lastSyncAt,
        lastSyncStatus: device.lastSyncStatus,
        revokedAt: device.revokedAt,
        createdAt: device.createdAt,
      })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      displayName: contact.displayName,
      payload: parseContactPayload(contact.payloadJson),
      syncVersion: contact.syncVersion.toString(),
      updatedAt: contact.updatedAt,
    })),
  };
}
