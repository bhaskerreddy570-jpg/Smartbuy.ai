import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import { RegisterForm } from '@/components/register-form';

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) redirect('/account');

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold">Create account</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Save products, set price alerts, and track your searches.
          </p>
          <div className="mt-6">
            <RegisterForm />
          </div>
          <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-emerald-600">Sign in</Link>
          </p>
        </div>
      </main>
    </>
  );
}
