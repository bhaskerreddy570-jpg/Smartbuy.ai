import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminCustomerDetailPanel } from "@/components/admin/admin-customer-detail-panel";
import { getAdminCustomerDetail } from "@/lib/admin/customers";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from "@/lib/admin/session";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const cookieStore = await cookies();
  const admin = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!admin) {
    redirect("/admin/login");
  }

  const { userId } = await params;
  const customer = await getAdminCustomerDetail(userId);

  if (!customer) {
    notFound();
  }

  return (
    <>
      <AdminNav email={admin.email} role={admin.role} />
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Link
          href="/admin/customers"
          className="text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          Back to customers
        </Link>
        <h1 className="mt-4 text-2xl font-semibold">Customer detail</h1>
        <div className="mt-8">
          <AdminCustomerDetailPanel customer={customer} />
        </div>
      </main>
    </>
  );
}
