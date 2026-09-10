import { getAffiliateAnalyticsSummary } from '@/lib/smartbuy/repositories/affiliate-repository';
import { orm } from '@/lib/db';

type CommissionRow = Awaited<ReturnType<typeof orm.AffiliateCommission.all>>[number];
type ProgramRow = Awaited<ReturnType<typeof orm.AffiliateProgram.all>>[number];

export default async function AdminAffiliatePage() {
  const stats = await getAffiliateAnalyticsSummary();

  let commissions: CommissionRow[] = [];
  let programs: ProgramRow[] = [];
  try {
    commissions = await orm.AffiliateCommission.orderBy((c) => c.createdAt.desc()).all();
    programs = await orm.AffiliateProgram.all();
  } catch {
    /* database may be unavailable */
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Affiliate programs</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Commission tracking separates estimated, confirmed, and paid revenue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total clicks" value={stats.totalClicks} />
        <StatCard label="Estimated revenue" value={`₹${stats.estimatedRevenue.toLocaleString('en-IN')}`} />
        <StatCard label="Confirmed revenue" value={`₹${stats.confirmedRevenue.toLocaleString('en-IN')}`} />
        <StatCard label="Paid revenue" value={`₹${stats.paidRevenue.toLocaleString('en-IN')}`} />
      </div>

      <section>
        <h2 className="text-lg font-medium">Programs</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Network</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {programs.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-zinc-500">No programs seeded. Run npm run db:seed.</td></tr>
              ) : (
                programs.map((p: ProgramRow) => (
                  <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-2">{p.name}</td>
                    <td className="px-4 py-2">{p.network ?? '—'}</td>
                    <td className="px-4 py-2">{p.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium">Recent commissions</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 text-left">State</th>
                <th className="px-4 py-2 text-left">Estimated</th>
                <th className="px-4 py-2 text-left">Confirmed</th>
                <th className="px-4 py-2 text-left">Paid</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {commissions.slice(0, 20).map((c: CommissionRow) => (
                <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{c.state}</td>
                  <td className="px-4 py-2">{c.estimatedAmount ?? '—'}</td>
                  <td className="px-4 py-2">{c.confirmedAmount ?? '—'}</td>
                  <td className="px-4 py-2">{c.paidAmount ?? '—'}</td>
                  <td className="px-4 py-2">{new Date(c.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
