import { AdminChangePasswordForm } from "@/components/admin/admin-change-password-form";

export default function AdminSecurityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin security</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Change your administrator password and review security controls.
        </p>
      </div>
      <section className="admin-card max-w-xl">
        <h2 className="text-lg font-semibold">Change password</h2>
        <div className="mt-4">
          <AdminChangePasswordForm />
        </div>
      </section>
      <section className="admin-card max-w-xl">
        <h2 className="text-lg font-semibold">Multi-factor authentication</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          MFA is not required for admin login in the current configuration.
        </p>
      </section>
    </div>
  );
}
