"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { OverviewData } from "@/lib/portal/data";
import { FileTypeIcon } from "@/components/portal/file-type-icon";

type OverviewClientProps = {
  data: OverviewData;
};

export function OverviewClient({ data }: OverviewClientProps) {
  const router = useRouter();
  const storagePercent =
    BigInt(data.storage.quota) > 0n
      ? Math.min(
          Number(
            (BigInt(data.storage.used) * 100n) / BigInt(data.storage.quota),
          ),
          100,
        )
      : 0;

  async function handleDownload(fileId: string) {
    const response = await fetch(`/api/files/${fileId}`);
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as {
      downloadUrl: string;
      fileName: string;
    };
    const link = document.createElement("a");
    link.href = payload.downloadUrl;
    link.download = payload.fileName;
    link.rel = "noopener noreferrer";
    link.click();
  }

  return (
    <div className="space-y-8 pb-24 lg:pb-6">
      <section className="portal-hero rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/50 sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600 dark:text-sky-300">
          Overview
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {data.greeting}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
          Everything you store, organized and secure.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="portal-card">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Storage
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {data.storage.usedLabel}
                <span className="text-lg font-normal text-zinc-500 dark:text-zinc-400">
                  {" "}
                  of {data.storage.quotaLabel}
                </span>
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {data.storage.availableLabel} remaining
              </p>
            </div>
            <p className="text-sm font-medium text-sky-700 dark:text-sky-300">
              {storagePercent.toFixed(1)}% used
            </p>
          </div>
          <div className="mt-5 h-4 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${storagePercent}%` }}
            />
          </div>
        </section>

        <section className="portal-card">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Monthly downloads
          </p>
          <p className="mt-2 text-2xl font-semibold">
            {data.bandwidth.usedLabel}
            <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">
              {" "}
              of {data.bandwidth.limitLabel}
            </span>
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {data.bandwidth.remainingLabel} remaining
          </p>
        </section>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Category usage</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {data.categoryUsage.map((category) => (
            <article key={category.id} className="portal-stat-card">
              <p className="text-sm font-medium">{category.label}</p>
              <p className="mt-3 text-lg font-semibold">{category.bytesLabel}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {category.fileCount} file{category.fileCount === 1 ? "" : "s"}
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                  style={{ width: `${category.percentOfQuota}%` }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="portal-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent files</h2>
            <Link href="/files" className="text-sm font-medium text-sky-700 dark:text-sky-300">
              View all
            </Link>
          </div>
          {data.recentFiles.length === 0 ? (
            <div className="portal-empty-state">
              <p>No uploads yet</p>
              <Link href="/files" className="portal-primary-button mt-4 inline-flex">
                Upload your first file
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileTypeIcon category={file.category} mimeType={file.mimeType} compact />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{file.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {file.categoryLabel} · {file.sizeLabel} ·{" "}
                        {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="portal-secondary-button"
                    onClick={() => void handleDownload(file.id)}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="portal-card">
          <h2 className="text-xl font-semibold">Quick actions</h2>
          <div className="mt-4 space-y-3">
            <Link href="/files" className="portal-action-card">
              <span className="portal-action-icon bg-gradient-to-br from-sky-500 to-indigo-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M12 16V6M8 10l4-4 4 4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                <span className="block font-medium">Upload file</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  Add a new file to your storage
                </span>
              </span>
            </Link>
            <Link href="/files" className="portal-action-card">
              <span className="portal-action-icon bg-gradient-to-br from-violet-500 to-purple-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M4 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span>
                <span className="block font-medium">Browse files</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  Open your full file manager
                </span>
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
