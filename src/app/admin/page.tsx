import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminCustomerStoragePanel } from "@/components/admin/admin-customer-storage-panel";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from "@/lib/admin/session";

export default async function AdminDashboardPage() {
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
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Break-glass console</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Server-side admin authorization, audit logging, and account recovery hooks.
        </p>

        <AdminCustomerStoragePanel />

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="font-medium">Customer account controls</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Lock or unlock customer accounts through authenticated admin API routes.
            </p>
            <code className="mt-4 block rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              POST /api/admin/customers/:userId/lock
            </code>
          </article>
          <article className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="font-medium">Recovery & operations</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Recovery tokens, backup requests, and data recovery requests are audit-logged.
            </p>
            <code className="mt-4 block rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-900">
              POST /api/admin/recovery/initiate
            </code>
          </article>
        </section>
      </main>
    </>
  );
}
