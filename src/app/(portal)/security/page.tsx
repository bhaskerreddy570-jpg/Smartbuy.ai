import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SecurityClient } from "@/components/portal/security-client";
import { getSecurityCenterData } from "@/lib/portal/security-data";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getSecurityCenterData(
    session.user.id,
    session.customerSessionId ?? null,
  );

  return <SecurityClient initialData={data} />;
}
