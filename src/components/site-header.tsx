"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Cloud Storage
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {pathname.startsWith("/dashboard") ? (
            <SignOutButton />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
