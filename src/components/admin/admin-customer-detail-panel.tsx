"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CategoryUsage = {
  category: string;
  label: string;
  bytesLabel: string;
  fileCount: number;
};

type CustomerDetail = {
  id: string;
  name: string | null;
  email: string;
  status: "Active" | "Locked";
  storageUsedLabel: string;
  storageQuotaLabel: string;
  storageQuota: string;
  maxFileSizeBytes: string;
  maxFileSizeLabel: string;
  bandwidthUsedLabel: string;
  bandwidthLimitLabel: string;
  bandwidthLimit: string;
  lockReason: string | null;
  categories: CategoryUsage[];
};

type AdminCustomerDetailPanelProps = {
  customer: CustomerDetail;
};

const GIB = 1024 * 1024 * 1024;

function bytesToGiBInput(bytes: string): string {
  const value = Number(BigInt(bytes)) / GIB;
  return Number.isFinite(value) ? value.toFixed(2) : "0";
}

function giBInputToBytes(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Invalid limit value");
  }
  return BigInt(Math.round(parsed * GIB)).toString();
}

export function AdminCustomerDetailPanel({
  customer,
}: AdminCustomerDetailPanelProps) {
  const router = useRouter();
  const [storageLimitGiB, setStorageLimitGiB] = useState(
    bytesToGiBInput(customer.storageQuota),
  );
  const [maxFileGiB, setMaxFileGiB] = useState(
    bytesToGiBInput(customer.maxFileSizeBytes),
  );
  const [bandwidthGiB, setBandwidthGiB] = useState(
    bytesToGiBInput(customer.bandwidthLimit),
  );
  const [lockReason, setLockReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageQuotaBytes: giBInputToBytes(storageLimitGiB),
          maxFileSizeBytes: giBInputToBytes(maxFileGiB),
          monthlyBandwidthLimitBytes: giBInputToBytes(bandwidthGiB),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save customer limits");
      }

      setMessage("Customer limits updated");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save customer limits",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLock() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: lockReason.trim() || "Locked by administrator",
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to lock customer");
      }

      setMessage("Customer locked");
      router.refresh();
    } catch (lockError) {
      setError(
        lockError instanceof Error ? lockError.message : "Unable to lock customer",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to unlock customer");
      }

      setMessage("Customer unlocked");
      router.refresh();
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "Unable to unlock customer",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">{customer.name || "Customer"}</h2>
        <p className="mt-1 text-sm text-zinc-500">{customer.email}</p>
        <p className="mt-4 text-sm">
          Storage: {customer.storageUsedLabel} / {customer.storageQuotaLabel}
        </p>
        <p className="mt-1 text-sm">
          Monthly downloads: {customer.bandwidthUsedLabel} /{" "}
          {customer.bandwidthLimitLabel}
        </p>
        <p className="mt-1 text-sm">Status: {customer.status}</p>
        {customer.lockReason ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">
            Lock reason: {customer.lockReason}
          </p>
        ) : null}
      </section>

      <form
        onSubmit={handleSave}
        className="grid gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h3 className="font-medium">Customer limits</h3>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Storage limit (GB)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={storageLimitGiB}
            onChange={(event) => setStorageLimitGiB(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Maximum file (GB)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={maxFileGiB}
            onChange={(event) => setMaxFileGiB(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Monthly bandwidth (GB)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={bandwidthGiB}
            onChange={(event) => setBandwidthGiB(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save changes
        </button>
      </form>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h3 className="font-medium">Account status</h3>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block font-medium">Lock reason</span>
          <input
            type="text"
            value={lockReason}
            onChange={(event) => setLockReason(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            placeholder="Optional reason shown internally"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={handleLock}
            className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Lock customer
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleUnlock}
            className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            Unlock customer
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
        <h3 className="font-medium">Storage by category</h3>
        <ul className="mt-4 space-y-2 text-sm">
          {customer.categories.map((category) => (
            <li
              key={category.category}
              className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-2 dark:bg-zinc-900"
            >
              <span>{category.label}</span>
              <span className="text-zinc-500">
                {category.bytesLabel}
                {category.fileCount > 0
                  ? ` (${category.fileCount} file${category.fileCount === 1 ? "" : "s"})`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
