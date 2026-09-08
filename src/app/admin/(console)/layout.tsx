import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from "@/lib/admin/session";
import { isAdminUser } from "@/lib/admin/authorization";

export default async function AdminConsoleLayout({
  children,
}: LayoutProps<"/admin">) {
  const cookieStore = await cookies();
  const admin = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!admin || !isAdminUser(admin)) {
    redirect("/admin/login");
  }

  return (
    <AdminShell email={admin.email} role={admin.role}>
      {children}
    </AdminShell>
  );
}
