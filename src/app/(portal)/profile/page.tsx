import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ProfileClient } from "@/components/portal/profile-client";
import { getProfileData } from "@/lib/portal/data";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getProfileData(session.user.id);
  if (!data) {
    redirect("/login");
  }

  return <ProfileClient initialData={data} />;
}
