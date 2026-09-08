import Image from "next/image";
import Link from "next/link";

const galleryItems = [
  {
    src: "/landing/photos.svg",
    alt: "Photo memories stored securely",
    label: "Photos",
    className: "col-span-2 row-span-2",
  },
  {
    src: "/landing/videos.svg",
    alt: "Video collection preview",
    label: "Videos",
    className: "col-span-1 row-span-1",
  },
  {
    src: "/landing/documents.svg",
    alt: "Important documents stored safely",
    label: "Documents",
    className: "col-span-1 row-span-1",
  },
  {
    src: "/landing/files.svg",
    alt: "Personal files organized in one place",
    label: "Files",
    className: "col-span-2 row-span-1",
  },
] as const;

const digitalLifeCategories = [
  {
    title: "Photos",
    description: "Keep your memories organized and protected.",
    src: "/landing/photos.svg",
    accent: "from-sky-400/20 to-indigo-500/10",
  },
  {
    title: "Videos",
    description: "Keep important moments accessible.",
    src: "/landing/videos.svg",
    accent: "from-violet-500/20 to-purple-600/10",
  },
  {
    title: "Documents",
    description: "Store important personal files securely.",
    src: "/landing/documents.svg",
    accent: "from-zinc-400/20 to-zinc-600/10",
  },
  {
    title: "Everything else",
    description: "Keep your digital life organized in one place.",
    src: "/landing/files.svg",
    accent: "from-amber-400/20 to-orange-500/10",
  },
] as const;

const storagePreviewCategories = [
  { label: "Photos", used: "4.2 GB", percent: 34, color: "bg-sky-500" },
  { label: "Videos", used: "6.1 GB", percent: 49, color: "bg-violet-500" },
  { label: "Documents", used: "1.7 GB", percent: 14, color: "bg-emerald-500" },
  { label: "Other", used: "0.4 GB", percent: 3, color: "bg-amber-500" },
] as const;

const landingDelayClasses = [
  "landing-delay-1",
  "landing-delay-2",
  "landing-delay-3",
  "landing-delay-4",
] as const;

export function LandingPage() {
  return (
    <main className="overflow-hidden">
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_42%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.16),transparent_30%)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
          <div className="landing-fade-up">
            <p className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
              CloudStoreNow
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl dark:text-zinc-50">
              Everything you love, safely in one place.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              Store your photos, videos, documents and important files securely.
              Access them whenever you need them, from anywhere.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-zinc-950 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-zinc-950/10 transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              >
                Get started
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Free to start. Your files stay private.
              </p>
            </div>
          </div>

          <div className="landing-fade-up landing-delay-1 relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-4 shadow-2xl shadow-blue-950/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 dark:shadow-black/20">
              <div className="mb-4 flex items-center justify-between px-1">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Your library
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Photos, videos, documents and files
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Secure
                </span>
              </div>
              <div className="grid grid-cols-3 grid-rows-3 gap-3">
                {galleryItems.map((item) => (
                  <article
                    key={item.label}
                    className={`group relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 ${item.className}`}
                  >
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 420px"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
            Organized storage
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
            Your digital life, organized.
          </h2>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-300">
            A beautiful home for the files that matter most, sorted into the
            categories you use every day.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {digitalLifeCategories.map((category, index) => (
            <article
              key={category.title}
              className={`landing-fade-up ${landingDelayClasses[index]} group overflow-hidden rounded-[1.75rem] border border-zinc-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-950`}
            >
              <div
                className={`relative h-44 overflow-hidden bg-gradient-to-br ${category.accent}`}
              >
                <Image
                  src={category.src}
                  alt={category.title}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 768px) 100vw, 280px"
                />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  {category.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {category.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
              Product preview
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
              A clear view of your storage
            </h2>
            <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-300">
              See how much space you are using and how it is divided across
              photos, videos, documents and other files.
            </p>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Demo preview only. Your real usage appears after you sign in.
            </p>
          </div>

          <div className="rounded-[2rem] border border-zinc-200/80 bg-white p-6 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-black/20 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Your storage
                </p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">
                  12.4 GB
                  <span className="text-lg font-normal text-zinc-500 dark:text-zinc-400">
                    {" "}
                    used of 50 GB
                  </span>
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                Demo
              </span>
            </div>

            <div className="mt-6 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-amber-400"
                style={{ width: "24.8%" }}
              />
            </div>

            <div className="mt-8 space-y-4">
              {storagePreviewCategories.map((category) => (
                <div key={category.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {category.label}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {category.used}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div
                      className={`h-full rounded-full ${category.color}`}
                      style={{ width: `${category.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <div className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-950 px-6 py-12 text-white shadow-2xl sm:px-10 lg:px-14 lg:py-16">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">
                Security
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Private by design
              </h2>
              <p className="mt-4 text-lg leading-8 text-zinc-300">
                Your files are protected with secure authentication, server-side
                access controls and private storage.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Secure sign-in for every account",
                "Private files with protected access",
                "Server-side checks on every request",
                "Your content stays yours",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-zinc-200 backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-zinc-300">
              Ready to keep your digital life safely in one place?
            </p>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
