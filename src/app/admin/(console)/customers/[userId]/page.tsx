import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCustomerDetailPanel } from "@/components/admin/admin-customer-detail-panel";
import {
  getAdminCustomerDetail,
  listAdminPlanOptions,
} from "@/lib/admin/customers";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const [customer, plans] = await Promise.all([
    getAdminCustomerDetail(userId),
    listAdminPlanOptions(),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/customers"
        className="text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
      >
        Back to customers
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Customer detail</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Manage account status and storage limits.
        </p>
      </div>
      <AdminCustomerDetailPanel customer={customer} plans={plans} />
    </div>
  );
}
