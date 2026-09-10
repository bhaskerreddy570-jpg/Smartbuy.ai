import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import { SearchBox } from '@/components/smartbuy/search-box';
import Link from 'next/link';

const CATEGORIES = [
  { name: 'Shopping', href: '/search?q=best+deals' },
  { name: 'Travel', href: '/search?q=flights+to+goa' },
  { name: 'Rides', href: '/search?q=compare+ride+options' },
  { name: 'Electronics', href: '/search?q=best+electronics' },
  { name: 'Fashion', href: '/search?q=fashion+deals' },
  { name: 'Beauty', href: '/search?q=beauty+products' },
  { name: 'Home', href: '/search?q=home+appliances' },
  { name: 'More', href: '/search' },
];

export default function HomePage() {
  return (
    <>
      <SmartBuyHeader />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:py-24">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
            Tell us what you want to buy.
            <br />
            <span className="text-emerald-600">We&apos;ll find the best deal.</span>
          </h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            AI-powered purchasing advisor for India. Compare prices across Amazon, Flipkart, Croma and more.
          </p>
          <div className="mt-8">
            <SearchBox large />
          </div>
        </section>

        <section className="border-t border-zinc-200 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="mb-6 text-center text-sm font-medium uppercase tracking-wide text-zinc-500">
              Browse categories
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.name}
                  href={cat.href}
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm font-medium text-zinc-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-12">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="text-2xl">🔍</div>
              <h3 className="mt-2 font-semibold">AI Search</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Describe what you need in plain language. No forms required.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="text-2xl">💰</div>
              <h3 className="mt-2 font-semibold">Best Price</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Same products matched across stores. Verified savings calculated.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
              <div className="text-2xl">✅</div>
              <h3 className="mt-2 font-semibold">Customer First</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Recommendations prioritize your needs, not commission.
              </p>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-200 py-8 dark:border-zinc-800">
          <div className="mx-auto max-w-4xl px-4 text-center text-xs text-zinc-500">
            <p>
              Some links may be affiliate links. We may earn a commission if you purchase through them.
              Our recommendations are primarily based on customer value and product suitability.
            </p>
            <div className="mt-2 flex justify-center gap-4">
              <Link href="/privacy" className="hover:text-zinc-700">Privacy</Link>
              <Link href="/terms" className="hover:text-zinc-700">Terms</Link>
              <Link href="/affiliate-disclosure" className="hover:text-zinc-700">Affiliate Disclosure</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
