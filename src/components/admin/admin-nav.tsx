"use client";

import { useRouter } from "next/navigation";

type AdminNavProps = {
  email: string;
  role: string;
};

export function AdminNav({ email, role }: AdminNavProps) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
            CloudStoreNow Admin
          </p>
          <p className="text-sm text-zinc-500">
            {email} · {role}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin/audit" className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300">
            Audit log
          </a>
          <a href="/admin/change-password" className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300">
            Change password
          </a>
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
