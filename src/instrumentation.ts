export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { ensureApplicationAdminProvisioned } = await import('@/lib/admin/bootstrap');
  const { ensurePlanConfigurationsSeeded } = await import('@/lib/plan-configuration');

  ensurePlanConfigurationsSeeded().catch((error) => {
    console.error('Plan configuration seed failed during startup', error);
  });

  ensureApplicationAdminProvisioned().catch((error) => {
    console.error('Application admin bootstrap failed during startup', error);
  });
}
