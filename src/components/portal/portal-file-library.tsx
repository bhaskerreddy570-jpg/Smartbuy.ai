"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import { FileTypeIcon } from "@/components/portal/file-type-icon";

type PortalFileLibraryProps = {
  initialData: DashboardData;
  mode: "starred" | "trash";
};

export function PortalFileLibrary({ initialData, mode }: PortalFileLibraryProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sorted = [...data.files].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (!query) {
      return sorted;
    }
    return sorted.filter((file) => file.name.toLowerCase().includes(query));
  }, [data.files, search]);

  async function refresh() {
    const query = mode === "starred" ? "?starred=true" : "?trash=true";
    const response = await fetch(`/api/files${query}`);
    if (response.status === 401) {
      router.push("/login");
      return;
    }
    if (!response.ok) {
      setError("Unable to load files");
      return;
    }
    setData((await response.json()) as DashboardData);
    setError(null);
  }

  async function handleDownload(fileId: string) {
    const response = await fetch(`/api/files/${fileId}`);
    if (!response.ok) {
      setError("Unable to download file");
      return;
    }
    const payload = (await response.json()) as { downloadUrl: string; fileName: string };
    const link = document.createElement("a");
    link.href = payload.downloadUrl;
    link.download = payload.fileName;
    link.rel = "noopener noreferrer";
    link.click();
  }

  async function handleRestore(fileId: string, fileName: string) {
    const response = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    if (!response.ok) {
      setError("Unable to restore file");
      return;
    }
    setMessage(`${fileName} restored`);
    await refresh();
  }

  async function handlePurge(fileId: string, fileName: string) {
    if (!window.confirm(`Permanently delete ${fileName}? This cannot be undone.`)) {
      return;
    }
    const response = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "purge" }),
    });
    if (!response.ok) {
      setError("Unable to delete file permanently");
      return;
    }
    setMessage(`${fileName} permanently deleted`);
    await refresh();
  }

  async function handleUnstar(fileId: string, fileName: string) {
    const response = await fetch(`/api/files/${fileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "star", starred: false }),
    });
    if (!response.ok) {
      setError("Unable to update starred status");
      return;
    }
    setMessage(`${fileName} removed from starred`);
    await refresh();
  }

  const title = mode === "starred" ? "Starred" : "Trash";
  const description =
    mode === "starred"
      ? "Quick access to files you have marked as favorites."
      : "Deleted files stay here until you restore them or delete them permanently.";

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search files..."
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
      </div>

      {message ? <p className="portal-alert-success">{message}</p> : null}
      {error ? <p className="portal-alert-error">{error}</p> : null}

      {filteredFiles.length === 0 ? (
        <div className="portal-empty-state portal-card">
          <p className="text-lg font-medium">
            {mode === "starred" ? "No starred files yet" : "Trash is empty"}
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === "starred"
              ? "Star files from My Files to see them here."
              : "Files you delete will appear here for recovery."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredFiles.map((file) => (
            <article key={file.id} className="portal-file-card">
              <div className="flex items-start gap-3">
                <FileTypeIcon category={file.category} mimeType={file.mimeType} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {file.categoryLabel} · {file.sizeLabel}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {mode === "trash" ? (
                  <>
                    <button
                      type="button"
                      className="portal-secondary-button"
                      onClick={() => void handleRestore(file.id, file.name)}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      className="portal-danger-button"
                      onClick={() => void handlePurge(file.id, file.name)}
                    >
                      Delete forever
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="portal-secondary-button"
                      onClick={() => void handleDownload(file.id)}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      className="portal-secondary-button"
                      onClick={() => void handleUnstar(file.id, file.name)}
                    >
                      Unstar
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
