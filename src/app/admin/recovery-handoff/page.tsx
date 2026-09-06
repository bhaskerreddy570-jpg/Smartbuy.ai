import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/admin/admin-nav';
import { RECOVERY_HANDOFF_COOKIE } from '@/lib/admin/recovery-handoff';
import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionUser,
} from '@/lib/admin/session';

export default async function AdminRecoveryHandoffPage() {
  const cookieStore = await cookies();
  const admin = await getAdminSessionUser(
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (!admin || admin.role !== 'ADMIN') {
    redirect('/admin/login');
  }

  const token = cookieStore.get(RECOVERY_HANDOFF_COOKIE)?.value;

  if (!token) {
    redirect('/admin');
  }

  cookieStore.set(RECOVERY_HANDOFF_COOKIE, '', {
    path: '/admin/recovery-handoff',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });

  return (
    <>
      <AdminNav email={admin.email} role={admin.role} />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="text-2xl font-semibold">One-time recovery token</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          Copy this token now. It will not be shown again and is not stored in audit logs.
        </p>
        <code className="mt-6 block break-all rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          {token}
        </code>
        <p className="mt-4 text-sm text-zinc-500">
          Deliver through your secure out-of-band channel, then use
          {' '}
          <code>/api/admin/recovery/complete</code>
          {' '}
          with the target admin email, this token, and a new password.
        </p>
      </main>
    </>
  );
}
