import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <section className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
            Cloud Storage Platform
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Secure personal cloud storage built for growth.
          </h1>
          <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Create an account, securely store your files, and manage your
            personal cloud storage from a private dashboard.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-5 py-3 font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Get started
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Private by default",
              body: "Your files stay in secure cloud storage with server-side authorization.",
            },
            {
              title: "Per-user isolation",
              body: "Every file operation verifies authenticated ownership on the server.",
            },
            {
              title: "Quota ready",
              body: "Storage usage and limits are enforced before uploads are accepted.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {item.body}
              </p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
