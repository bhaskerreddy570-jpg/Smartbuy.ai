"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useMemo, useState } from "react";
import type { DashboardData } from "@/lib/dashboard";
import type { FileCategory } from "@/lib/storage/types";
import { FileTypeIcon } from "@/components/portal/file-type-icon";

type FilesClientProps = {
  initialData: DashboardData;
  initialQuery?: string;
};

type ViewMode = "grid" | "list";

function sortFiles(
  files: DashboardData["files"],
  sortBy: "name" | "size" | "date",
) {
  return [...files].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === "size") {
      return Number(BigInt(b.size) - BigInt(a.size));
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function FilesClient({ initialData, initialQuery = "" }: FilesClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("date");
  const [search, setSearch] = useState(initialQuery);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = sortFiles(data.files, sortBy);
    if (!query) {
      return base;
    }
    return base.filter((file) => file.name.toLowerCase().includes(query));
  }, [data.files, search, sortBy]);

  async function refreshFiles(category?: FileCategory | null) {
    const queryParts: string[] = [];
    const activeCategory =
      category !== undefined ? category : data.activeCategory;
    if (activeCategory) {
      queryParts.push(`category=${encodeURIComponent(activeCategory)}`);
    }

    const response = await fetch(
      `/api/files${queryParts.length ? `?${queryParts.join("&")}` : ""}`,
    );

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setError("Unable to load your files");
      return;
    }

    const payload = (await response.json()) as DashboardData;
    setData(payload);
    setError(null);
  }

  async function handleCategoryChange(category: FileCategory | null) {
    setActionMessage(null);
    setError(null);

    const query = category ? `?category=${encodeURIComponent(category)}` : "";
    const response = await fetch(`/api/files${query}`);

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      setError("Unable to load your files");
      return;
    }

    const payload = (await response.json()) as DashboardData;
    setData(payload);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setActionMessage(null);
    setError(null);

    try {
      const requestResponse = await fetch("/api/files/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }),
      });

      if (!requestResponse.ok) {
        const payload = (await requestResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error === "STORAGE_QUOTA_EXCEEDED"
            ? "Storage limit reached"
            : payload?.error === "FILE_SIZE_LIMIT_EXCEEDED"
              ? "File exceeds your maximum upload size"
              : payload?.error ?? "Upload request failed",
        );
      }

      const { fileId, uploadUrl, contentType } = (await requestResponse.json()) as {
        fileId: string;
        uploadUrl: string;
        contentType: string;
      };

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": contentType || "application/octet-stream",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload to storage failed");
      }

      const completeResponse = await fetch("/api/files/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      if (!completeResponse.ok) {
        const payload = (await completeResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Upload completion failed");
      }

      setActionMessage(`${file.name} uploaded successfully`);
      await refreshFiles(data.activeCategory);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      await uploadFile(file);
    }
  }

  async function handleDownload(fileId: string) {
    setActionMessage(null);
    setError(null);

    const response = await fetch(`/api/files/${fileId}`);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(
        payload?.error === "BANDWIDTH_LIMIT_EXCEEDED"
          ? "Monthly download limit reached"
          : "Unable to download file",
      );
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

  async function handleDelete(fileId: string, fileName: string) {
    if (!window.confirm(`Delete ${fileName}?`)) {
      return;
    }

    setActionMessage(null);
    setError(null);

    const response = await fetch(`/api/files/${fileId}`, { method: "DELETE" });

    if (!response.ok) {
      setError("Unable to delete file");
      return;
    }

    setActionMessage(`${fileName} deleted`);
    await refreshFiles(data.activeCategory);
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My Files</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Upload, organize, and manage your private cloud storage.
          </p>
        </div>
        <label className="portal-primary-button cursor-pointer">
          {uploading ? "Uploading..." : "Upload file"}
          <input type="file" className="hidden" disabled={uploading} onChange={handleUpload} />
        </label>
      </div>

      <div
        className={`portal-upload-zone rounded-3xl border-2 border-dashed p-8 text-center transition ${
          dragActive
            ? "border-sky-400 bg-sky-50/80 dark:border-sky-500 dark:bg-sky-950/30"
            : "border-zinc-200 bg-white/70 dark:border-zinc-700 dark:bg-zinc-950/50"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file) {
            await uploadFile(file);
          }
        }}
      >
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
              <path d="M12 16V6M8 10l4-4 4 4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-sm font-medium">Drag and drop a file here, or use the upload button</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Max file size: {data.maxFileSize.label}
          </p>
        </div>
      </div>

      <section className="portal-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleCategoryChange(null)}
              className={data.activeCategory === null ? "portal-chip-active" : "portal-chip"}
            >
              All Files
            </button>
            {data.categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryChange(category.id)}
                className={
                  data.activeCategory === category.id ? "portal-chip-active" : "portal-chip"
                }
              >
                {category.label}
                {category.count > 0 ? ` (${category.count})` : ""}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files..."
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as "name" | "size" | "date")
              }
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="date">Newest first</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
            </select>
            <div className="flex rounded-xl border border-zinc-200 p-1 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "portal-chip-active !rounded-lg" : "portal-chip !rounded-lg !border-0"}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "portal-chip-active !rounded-lg" : "portal-chip !rounded-lg !border-0"}
              >
                Grid
              </button>
            </div>
          </div>
        </div>

        {actionMessage ? (
          <p className="portal-alert-success mt-4">{actionMessage}</p>
        ) : null}
        {error ? <p className="portal-alert-error mt-4">{error}</p> : null}

        {filteredFiles.length === 0 ? (
          <div className="portal-empty-state mt-8">
            <p className="text-lg font-medium">No files here yet</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Upload your first file to get started.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <div className="mt-4 flex gap-2">
                  <button type="button" className="portal-secondary-button" onClick={() => handleDownload(file.id)}>
                    Download
                  </button>
                  <button
                    type="button"
                    className="portal-danger-button"
                    onClick={() => handleDelete(file.id, file.name)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="portal-table min-w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <FileTypeIcon category={file.category} mimeType={file.mimeType} compact />
                        <span className="font-medium">{file.name}</span>
                      </div>
                    </td>
                    <td>{file.categoryLabel}</td>
                    <td>{file.sizeLabel}</td>
                    <td>{new Date(file.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="relative">
                        <button
                          type="button"
                          className="portal-secondary-button"
                          onClick={() =>
                            setOpenMenuId(openMenuId === file.id ? null : file.id)
                          }
                        >
                          Actions
                        </button>
                        {openMenuId === file.id ? (
                          <div className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                            <button
                              type="button"
                              className="portal-menu-item w-full text-left"
                              onClick={() => {
                                setOpenMenuId(null);
                                void handleDownload(file.id);
                              }}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className="portal-menu-item w-full text-left text-red-600 dark:text-red-400"
                              onClick={() => {
                                setOpenMenuId(null);
                                void handleDelete(file.id, file.name);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
