import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { orm } from "@/lib/db";
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from "@/lib/admin/session";

export default async function AdminAuditPage() {
  const cookieStore = await cookies();
  const admin = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!admin) {
    redirect("/admin/login");
  }

  const logs = await orm.AdminAuditLog.select(
    "id",
    "action",
    "adminUserId",
    "targetType",
    "targetId",
    "ipAddress",
    "createdAt",
  ).all();

  const sorted = logs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);

  return (
    <>
      <AdminNav email={admin.email} role={admin.role} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="text-2xl font-semibold">Admin audit log</h1>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((log) => (
                <tr key={log.id} className="border-b border-zinc-100 last:border-none dark:border-zinc-900">
                  <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{log.action}</td>
                  <td className="px-4 py-3">
                    {log.targetType ?? "—"}
                    {log.targetId ? ` / ${log.targetId}` : ""}
                  </td>
                  <td className="px-4 py-3">{log.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
