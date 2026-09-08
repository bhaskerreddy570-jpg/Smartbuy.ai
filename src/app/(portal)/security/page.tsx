import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SecurityClient } from "@/components/portal/security-client";
import { listCustomerDevices } from "@/lib/contacts/sync-service";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const devices = await listCustomerDevices(session.user.id);

  return (
    <SecurityClient
      initialDevices={devices.map((device) => ({
        id: device.id,
        displayName: device.displayName,
        platform: device.platform,
        lastSyncAt: device.lastSyncAt,
        revokedAt: device.revokedAt,
      }))}
    />
  );
}
