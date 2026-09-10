import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import Link from 'next/link';

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">My Account</h1>
        <div className="mt-6 space-y-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <div>
            <p className="text-sm text-zinc-500">Email</p>
            <p className="font-medium">{session.user.email}</p>
          </div>
          {session.user.name && (
            <div>
              <p className="text-sm text-zinc-500">Name</p>
              <p className="font-medium">{session.user.name}</p>
            </div>
          )}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link href="/alerts" className="rounded-xl border border-zinc-200 p-4 hover:border-emerald-300 dark:border-zinc-800">
            <h3 className="font-medium">Price Alerts</h3>
            <p className="text-sm text-zinc-500">Get notified when prices drop</p>
          </Link>
          <Link href="/saved" className="rounded-xl border border-zinc-200 p-4 hover:border-emerald-300 dark:border-zinc-800">
            <h3 className="font-medium">Saved Products</h3>
            <p className="text-sm text-zinc-500">Your bookmarked items</p>
          </Link>
          <Link href="/history" className="rounded-xl border border-zinc-200 p-4 hover:border-emerald-300 dark:border-zinc-800">
            <h3 className="font-medium">Search History</h3>
            <p className="text-sm text-zinc-500">Recent searches</p>
          </Link>
        </div>
      </main>
    </>
  );
}
