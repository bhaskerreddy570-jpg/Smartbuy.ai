import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardData } from "@/lib/dashboard";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const initialData = await getDashboardData(session.user.id);

  if (!initialData) {
    redirect("/login");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as {session.user.email}
          </p>
        </div>
        <DashboardClient initialData={initialData} />
      </main>
    </>
  );
}
