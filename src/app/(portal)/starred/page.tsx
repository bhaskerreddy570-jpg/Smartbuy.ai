import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PortalFileLibrary } from "@/components/portal/portal-file-library";
import { getDashboardData } from "@/lib/dashboard";

export default async function StarredPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getDashboardData(session.user.id, { starred: true });
  if (!data) {
    redirect("/login");
  }

  return <PortalFileLibrary initialData={data} mode="starred" />;
}
