"use client";

import Link from "next/link";

export type AdminCustomerRow = {
  id: string;
  name: string | null;
  email: string;
  status: "Active" | "Locked";
  storageUsedLabel: string;
  storageQuotaLabel: string;
  storageRemainingLabel: string;
  bandwidthUsedLabel: string;
  bandwidthLimitLabel: string;
  bandwidthRemainingLabel: string;
  fileCount: number;
};

type AdminCustomersTableProps = {
  customers: AdminCustomerRow[];
};

export function AdminCustomersTable({ customers }: AdminCustomersTableProps) {
  if (customers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No customers found.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Customer</th>
            <th className="px-4 py-3 text-left font-medium">Email</th>
            <th className="px-4 py-3 text-left font-medium">Status</th>
            <th className="px-4 py-3 text-left font-medium">Storage Used</th>
            <th className="px-4 py-3 text-left font-medium">Storage Limit</th>
            <th className="px-4 py-3 text-left font-medium">Storage Remaining</th>
            <th className="px-4 py-3 text-left font-medium">Bandwidth Used</th>
            <th className="px-4 py-3 text-left font-medium">Bandwidth Limit</th>
            <th className="px-4 py-3 text-left font-medium">Bandwidth Remaining</th>
            <th className="px-4 py-3 text-left font-medium">Files</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
          {customers.map((customer) => (
            <tr key={customer.id}>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="font-medium text-blue-700 hover:underline dark:text-blue-300"
                >
                  {customer.name || "Customer"}
                </Link>
              </td>
              <td className="px-4 py-3">{customer.email}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    customer.status === "Locked"
                      ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                      : "rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }
                >
                  {customer.status}
                </span>
              </td>
              <td className="px-4 py-3">{customer.storageUsedLabel}</td>
              <td className="px-4 py-3">{customer.storageQuotaLabel}</td>
              <td className="px-4 py-3">{customer.storageRemainingLabel}</td>
              <td className="px-4 py-3">{customer.bandwidthUsedLabel}</td>
              <td className="px-4 py-3">{customer.bandwidthLimitLabel}</td>
              <td className="px-4 py-3">{customer.bandwidthRemainingLabel}</td>
              <td className="px-4 py-3">{customer.fileCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
