import Link from "next/link";
import { listAdminCustomers } from "@/lib/admin/customers";

export default async function AdminFilesPage() {
  const customers = await listAdminCustomers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Files</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Customer file inventory summary. Open a customer record to review files in detail.
        </p>
      </div>
      <div className="admin-card overflow-x-auto">
        <table className="admin-table min-w-full">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th>Files</th>
              <th>Storage used</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.name ?? "—"}</td>
                <td>{customer.email}</td>
                <td>{customer.fileCount}</td>
                <td>{customer.storageUsedLabel}</td>
                <td>
                  <Link
                    href={`/admin/customers/${customer.id}`}
                    className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
                  >
                    View customer
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
