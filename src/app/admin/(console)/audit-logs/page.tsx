import { orm } from "@/lib/db";

export default async function AdminAuditLogsPage() {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit logs</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Recent administrative actions recorded server-side.
        </p>
      </div>
      <div className="admin-card overflow-x-auto">
        <table className="admin-table min-w-full">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Target</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.action}</td>
                <td>
                  {log.targetType ?? "—"}
                  {log.targetId ? ` / ${log.targetId}` : ""}
                </td>
                <td>{log.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
