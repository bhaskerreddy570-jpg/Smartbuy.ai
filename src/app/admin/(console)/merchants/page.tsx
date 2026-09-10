import { MOCK_MERCHANTS } from '@/lib/smartbuy/providers/mock-data';

export default function AdminMerchantsPage() {
  const merchants = Object.entries(MOCK_MERCHANTS);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Merchant & Affiliate Management</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="admin-table min-w-full">
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Affiliate Tag</th>
              <th>Default Rate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map(([slug, m]) => (
              <tr key={slug}>
                <td className="font-medium">{m.name}</td>
                <td>{m.affiliateTag}</td>
                <td>{(m.commissionRate * 100).toFixed(1)}%</td>
                <td><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">ACTIVE</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
