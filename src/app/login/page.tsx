import { Suspense } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Access your secure cloud storage dashboard.
          </p>
          <div className="mt-6">
            <Suspense fallback={<p>Loading...</p>}>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Need an account?{" "}
            <Link href="/register" className="font-medium text-blue-600">
              Create one
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
