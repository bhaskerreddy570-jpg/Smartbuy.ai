import { orm } from '@/lib/db';

export default async function AdminUsersPage() {
  let users: Array<{
    id: string;
    email: string;
    name: string | null;
    lockedAt: string | null;
    createdAt: string;
  }> = [];

  try {
    users = await orm.User.orderBy((u) => u.createdAt.desc()).all();
    users = users.slice(0, 100);
  } catch {
    /* database may be unavailable */
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">Registered customer accounts.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-zinc-500">No users or database unavailable.</td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">{u.name ?? '—'}</td>
                  <td className="px-4 py-2">{u.lockedAt ? 'Locked' : 'Active'}</td>
                  <td className="px-4 py-2">{new Date(u.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
