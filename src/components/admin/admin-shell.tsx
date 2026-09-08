"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type AdminShellProps = {
  email: string;
  role: string;
  children: React.ReactNode;
};

const navItems = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/storage", label: "Storage" },
  { href: "/admin/usage", label: "Usage" },
  { href: "/admin/files", label: "Files" },
  { href: "/admin/audit-logs", label: "Audit logs" },
  { href: "/admin/recovery", label: "Recovery" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/profile", label: "Profile" },
  { href: "/admin/security", label: "Security" },
] as const;

export function AdminShell({ email, role, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-shell min-h-screen bg-[linear-gradient(180deg,#fffbeb_0%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#1c1917_0%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-amber-100 bg-white/80 p-5 backdrop-blur-xl dark:border-amber-900/30 dark:bg-zinc-950/50 lg:block">
          <div className="admin-logo">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M12 3 20 7v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Admin Portal</p>
              <p className="text-xs text-amber-700 dark:text-amber-300">CloudStoreNow</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navItems.map((item) => {
              const active =
                "exact" in item && item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-link ${active ? "admin-nav-link-active" : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50/70 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Signed in
            </p>
            <p className="mt-2 truncate text-sm font-medium">{email}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{role}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-amber-100 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-amber-900/30 dark:bg-zinc-950/70 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                  Administration
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Server-side authorized console
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/overview" className="admin-secondary-button hidden sm:inline-flex">
                  Customer portal
                </Link>
                <button type="button" onClick={handleLogout} className="admin-secondary-button">
                  Sign out
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
