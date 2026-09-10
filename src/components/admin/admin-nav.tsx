'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

type AdminNavProps = {
  email: string;
  role: string;
};

const NAV_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/providers', label: 'Providers' },
  { href: '/admin/merchants', label: 'Merchants' },
  { href: '/admin/audit-logs', label: 'Audit' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminNav({ email, role }: AdminNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            SmartBuy AI Admin
          </p>
          <p className="text-sm text-zinc-500">{email} · {role}</p>
        </div>
        <div className="flex items-center gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
