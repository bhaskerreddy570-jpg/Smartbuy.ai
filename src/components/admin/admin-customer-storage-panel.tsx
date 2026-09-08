"use client";

import { FormEvent, useState } from "react";

type CategoryUsage = {
  category: string;
  label: string;
  bytesUsed: string;
  bytesLabel: string;
  fileCount: number;
};

type StorageUsageResponse = {
  userId: string;
  storageUsed: string;
  storageUsedLabel: string;
  secureFileCount?: number;
  categories: CategoryUsage[];
};

export function AdminCustomerStoragePanel() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setUsage(null);

    try {
      const response = await fetch(
        `/api/admin/customers/${encodeURIComponent(userId.trim())}/storage`,
      );

      if (response.status === 404) {
        setError("Customer not found");
        return;
      }

      if (response.status === 401) {
        setError("Admin session required");
        return;
      }

      if (!response.ok) {
        setError("Unable to load storage usage");
        return;
      }

      setUsage((await response.json()) as StorageUsageResponse);
    } catch {
      setError("Unable to load storage usage");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
      <h2 className="font-medium">Customer storage usage</h2>
      <p className="mt-2 text-sm text-zinc-500">
        View per-category storage usage for a customer account.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="Customer user ID"
          className="flex-1 rounded-xl border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Loading..." : "Load usage"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {usage ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm">
            <span className="font-medium">Customer:</span>{" "}
            <span className="font-mono text-xs">{usage.userId}</span>
          </p>
          <p className="text-sm">
            <span className="font-medium">Storage Used:</span>{" "}
            {usage.storageUsedLabel}
          </p>
          {typeof usage.secureFileCount === "number" ? (
            <p className="text-sm">
              <span className="font-medium">Secure / Zero-Knowledge files:</span>{" "}
              {usage.secureFileCount} 🔐
            </p>
          ) : null}
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
            Secure files are encrypted client-side. Admins cannot decrypt secure file
            contents or recover customer encryption keys.
          </p>
          <ul className="space-y-2 text-sm">
            {usage.categories.map((category) => (
              <li
                key={category.category}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-2 dark:bg-zinc-900"
              >
                <span>{category.label}</span>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {category.bytesLabel}
                  {category.fileCount > 0
                    ? ` (${category.fileCount} file${category.fileCount === 1 ? "" : "s"})`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
