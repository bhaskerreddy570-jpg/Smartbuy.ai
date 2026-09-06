import { AdminLoginForm } from "@/components/admin/admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold">Admin / Break-Glass</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Password-only access for the current phase. MFA is not enabled yet.
        </p>
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    </main>
  );
}
