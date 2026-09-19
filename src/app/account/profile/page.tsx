import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { SmartBuyHeader } from '@/components/smartbuy/site-header';
import { ProfileForm } from '@/components/account/profile-form';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold">Profile & Security</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Manage your personal information, password and active sessions.
        </p>
        <div className="mt-6">
          <ProfileForm />
        </div>
      </main>
    </>
  );
}
