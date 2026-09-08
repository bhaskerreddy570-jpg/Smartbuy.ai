import { listAdminCustomers } from "@/lib/admin/customers";
import { AdminCustomersTable } from "@/components/admin/admin-customers-table";

export default async function AdminCustomersPage() {
  const customers = await listAdminCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Customer management</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Review customer storage, bandwidth, and account limits.
        </p>
      </div>
      <AdminCustomersTable customers={customers} />
    </div>
  );
}
