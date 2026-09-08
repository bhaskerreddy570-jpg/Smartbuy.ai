import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ContactsClient } from "@/components/portal/contacts-client";
import {
  getContactBackupSummary,
  listActiveContacts,
  listCustomerDevices,
} from "@/lib/contacts/sync-service";
import { parseContactPayload } from "@/lib/contacts/payload";

export default async function ContactsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [summary, devices, contacts] = await Promise.all([
    getContactBackupSummary(session.user.id),
    listCustomerDevices(session.user.id),
    listActiveContacts(session.user.id),
  ]);

  return (
    <ContactsClient
      initialData={{
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
      }}
    />
  );
}
