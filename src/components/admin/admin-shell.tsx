"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSiteName } from "@/lib/site-config";

type AdminShellProps = {
  email: string;
  role: string;
  children: React.ReactNode;
};

const navItems = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/providers", label: "Providers" },
  { href: "/admin/merchants", label: "Merchants" },
  { href: "/admin/affiliate", label: "Affiliate" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/matching", label: "Matching" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/alerts", label: "Alerts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/ai-config", label: "AI config" },
  { href: "/admin/health", label: "System health" },
  { href: "/admin/audit-logs", label: "Audit logs" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/security", label: "Security" },
  { href: "/admin/profile", label: "Profile" },
] as const;

export function AdminShell({ email, role, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const siteName = getSiteName();

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="admin-shell min-h-screen bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#042f2e_0%,#0f172a_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-emerald-100 bg-white/80 p-5 backdrop-blur-xl dark:border-emerald-900/30 dark:bg-zinc-950/50 lg:block">
          <div className="admin-logo">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M12 3 20 7v6c0 5-3.5 7.5-8 8-4.5-.5-8-3-8-8V7l8-4Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Admin Portal</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">{siteName}</p>
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

          <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              Signed in
            </p>
            <p className="mt-2 truncate text-sm font-medium">{email}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{role}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/80 px-4 py-3 backdrop-blur-xl dark:border-emerald-900/30 dark:bg-zinc-950/70 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{siteName} Admin</p>
                <p className="text-xs text-zinc-500">Operations console</p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/" className="text-sm text-emerald-700 hover:underline dark:text-emerald-300">
                  Customer site
                </Link>
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
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
