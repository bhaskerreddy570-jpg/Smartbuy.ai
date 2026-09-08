import Link from "next/link";
import { AdminCustomerStoragePanel } from "@/components/admin/admin-customer-storage-panel";

export default function AdminRecoveryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Recovery</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Break-glass recovery hooks and operational controls.
        </p>
      </div>
      <AdminCustomerStoragePanel />
      <section className="admin-card">
        <h2 className="text-lg font-semibold">Recovery endpoints</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Recovery token issuance and data recovery requests are available through authenticated admin APIs and are audit-logged.
        </p>
        <Link
          href="/admin/recovery-handoff"
          className="admin-secondary-button mt-4 inline-flex"
        >
          Open recovery handoff
        </Link>
      </section>
    </div>
  );
}
