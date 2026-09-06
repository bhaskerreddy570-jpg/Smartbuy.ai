import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Start with secure personal cloud storage and a default free quota.
          </p>
          <div className="mt-6">
            <RegisterForm />
          </div>
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-blue-600">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
