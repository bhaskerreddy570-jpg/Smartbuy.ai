import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";
import { getPortalContext } from "@/lib/portal/data";

export default async function PortalLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const context = await getPortalContext(session.user.id);

  if (!context) {
    redirect("/login");
  }

  return (
    <PortalShell
      user={context.user}
      storageSummary={context.storageSummary}
      hasAdminSession={context.hasAdminSession}
    >
      {children}
    </PortalShell>
  );
}
