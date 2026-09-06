import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminChangePasswordForm } from "@/components/admin/admin-change-password-form";
import { AdminNav } from "@/components/admin/admin-nav";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from "@/lib/admin/session";

export default async function AdminChangePasswordPage() {
  const cookieStore = await cookies();
  const admin = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <>
      <AdminNav email={admin.email} role={admin.role} />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Change admin password</h1>
        <p className="mt-2 text-sm text-zinc-500">
          All existing admin sessions are revoked after a successful password change.
        </p>
        <div className="mt-8">
          <AdminChangePasswordForm />
        </div>
      </main>
    </>
  );
}
