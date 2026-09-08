import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "@/components/portal/settings-client";
import { getProfileData } from "@/lib/portal/data";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getProfileData(session.user.id);
  if (!data) {
    redirect("/login");
  }

  return <SettingsClient data={data} />;
}
