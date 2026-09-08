import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminCustomersTable } from "@/components/admin/admin-customers-table";
import { listAdminCustomers } from "@/lib/admin/customers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from "@/lib/admin/session";

export default async function AdminCustomersPage() {
  const cookieStore = await cookies();
  const admin = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!admin) {
    redirect("/admin/login");
  }

  const customers = await listAdminCustomers();

  return (
    <>
      <AdminNav email={admin.email} role={admin.role} />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Customer management</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Review customer storage, bandwidth, and account limits.
        </p>
        <div className="mt-8">
          <AdminCustomersTable customers={customers} />
        </div>
      </main>
    </>
  );
}
