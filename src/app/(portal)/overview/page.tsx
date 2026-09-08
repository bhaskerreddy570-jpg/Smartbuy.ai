import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { OverviewClient } from "@/components/portal/overview-client";
import { getOverviewData } from "@/lib/portal/data";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getOverviewData(session.user.id);
  if (!data) {
    redirect("/login");
  }

  return <OverviewClient data={data} />;
}
