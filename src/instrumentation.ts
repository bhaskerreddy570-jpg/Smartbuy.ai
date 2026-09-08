export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { ensureApplicationAdminProvisioned } = await import('@/lib/admin/bootstrap');
  ensureApplicationAdminProvisioned().catch((error) => {
    console.error('Application admin bootstrap failed during startup', error);
  });
}
