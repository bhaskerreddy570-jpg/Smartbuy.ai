"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";
import { StorageMeter } from "@/components/storage-meter";
import type { DashboardData } from "@/lib/dashboard";
import type { FileCategory } from "@/lib/storage/types";

type DashboardClientProps = {
  initialData: DashboardData;
};

export function DashboardClient({ initialData }: DashboardClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function refreshFiles(category?: FileCategory | null) {
    const query =
      category && category !== data.activeCategory
        ? `?category=${encodeURIComponent(category)}`
        : category
          ? `?category=${encodeURIComponent(category)}`
          : data.activeCategory
            ? `?category=${encodeURIComponent(data.activeCategory)}`
            : "";

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

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

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
        throw new Error(payload?.error ?? "Upload request failed");
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

  async function handleDownload(fileId: string) {
    setActionMessage(null);
    setError(null);

    const response = await fetch(`/api/files/${fileId}`);

    if (!response.ok) {
      setError("Unable to download file");
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
    <div className="space-y-6">
      <StorageMeter
        used={BigInt(data.storage.used)}
        quota={BigInt(data.storage.quota)}
        usedLabel={data.storage.usedLabel}
        quotaLabel={data.storage.quotaLabel}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">My Files</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Upload, download, and manage your private cloud storage.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500">
            {uploading ? "Uploading..." : "Upload file"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCategoryChange(null)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              data.activeCategory === null
                ? "bg-blue-600 text-white"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }`}
          >
            All Files
          </button>
          {data.categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryChange(category.id)}
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                data.activeCategory === category.id
                  ? "bg-blue-600 text-white"
                  : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              {category.label}
              {category.count > 0 ? ` (${category.count})` : ""}
            </button>
          ))}
        </div>

        {actionMessage ? (
          <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
            {actionMessage}
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-3 font-medium">Name</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 font-medium">Size</th>
                <th className="px-3 py-3 font-medium">Uploaded</th>
                <th className="px-3 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.files.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No files in this category yet.
                  </td>
                </tr>
              ) : (
                data.files.map((file) => (
                  <tr
                    key={file.id}
                    className="border-b border-zinc-100 last:border-none dark:border-zinc-900"
                  >
                    <td className="px-3 py-4 font-medium">{file.name}</td>
                    <td className="px-3 py-4">{file.categoryLabel}</td>
                    <td className="px-3 py-4">{file.sizeLabel}</td>
                    <td className="px-3 py-4">
                      {new Date(file.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(file.id)}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(file.id, file.name)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
