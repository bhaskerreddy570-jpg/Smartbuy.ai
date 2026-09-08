export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin settings</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Console preferences and operational notes.
        </p>
      </div>
      <section className="admin-card">
        <h2 className="text-lg font-semibold">Console</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Admin settings are managed through environment configuration and secure bootstrap flows. No secrets are displayed here.
        </p>
      </section>
    </div>
  );
}
