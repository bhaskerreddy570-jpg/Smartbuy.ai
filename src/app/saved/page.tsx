import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import { orm } from '@/lib/db';

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/saved');

  const products: Array<{ id: string; title: string; brand: string | null; category: string }> = [];

  try {
    const saved = await orm.SavedProduct.where({ userId: session.user.id }).all();
    for (const item of saved) {
      const product = await orm.Product.where({ id: item.productId })
        .select('id', 'title', 'brand', 'category')
        .first();
      if (product) products.push(product);
    }
  } catch {
    /* database may be unavailable */
  }

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Saved Products</h1>

        {products.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
            <p className="text-zinc-500">No saved products yet.</p>
            <Link href="/search" className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline">
              Search and save products
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {products.map((product) => (
              <li
                key={product.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <p className="font-medium">{product.title}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {product.brand ?? 'Unknown brand'} · {product.category}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
