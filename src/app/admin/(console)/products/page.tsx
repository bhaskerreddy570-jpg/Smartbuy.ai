import { orm } from '@/lib/db';

export default async function AdminProductsPage() {
  let products: Array<{
    id: string;
    title: string;
    brand: string | null;
    category: string;
    createdAt: string;
  }> = [];

  try {
    products = await orm.Product.orderBy((p) => p.createdAt.desc()).all();
  } catch {
    /* database may be unavailable */
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Canonical product catalog used for matching and price history.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Brand</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-zinc-500">
                  No products. Run npm run db:seed or sync from providers.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{p.title}</td>
                  <td className="px-4 py-2">{p.brand ?? '—'}</td>
                  <td className="px-4 py-2">{p.category}</td>
                  <td className="px-4 py-2">{new Date(p.createdAt).toLocaleString('en-IN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
