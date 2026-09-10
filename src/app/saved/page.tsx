import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?redirect=/saved');

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Saved Products</h1>
        <div className="mt-8 rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-zinc-500">No saved products yet.</p>
        </div>
      </main>
    </>
  );
}
