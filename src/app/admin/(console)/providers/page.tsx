import { getProviderSlugs } from '@/lib/smartbuy/providers/registry';
import { MOCK_MERCHANTS } from '@/lib/smartbuy/providers/mock-data';

export default function AdminProvidersPage() {
  const providers = getProviderSlugs();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Provider Management</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="admin-table min-w-full">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Data Mode</th>
              <th>Affiliate</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((slug) => {
              const merchant = MOCK_MERCHANTS[slug as keyof typeof MOCK_MERCHANTS];
              return (
                <tr key={slug}>
                  <td className="font-medium">{merchant?.name ?? slug}</td>
                  <td><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">ACTIVE</span></td>
                  <td>MOCK</td>
                  <td>ENABLED</td>
                  <td>{((merchant?.commissionRate ?? 0) * 100).toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-zinc-500">
        Real provider adapters replace mocks when API credentials are configured.
      </p>
    </div>
  );
}
