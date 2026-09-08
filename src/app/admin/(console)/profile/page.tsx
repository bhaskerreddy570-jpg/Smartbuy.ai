import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from "@/lib/admin/session";

export default async function AdminProfilePage() {
  const cookieStore = await cookies();
  const admin = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin profile</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Your administrator account details.
        </p>
      </div>
      <section className="admin-card">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
            <dd className="mt-1 text-lg font-medium">{admin.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Role</dt>
            <dd className="mt-1 text-lg font-medium">{admin.role}</dd>
          </div>
          {admin.displayName ? (
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Display name</dt>
              <dd className="mt-1 font-medium">{admin.displayName}</dd>
            </div>
          ) : null}
        </dl>
      </section>
    </div>
  );
}
