"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type LimitLayerView = {
  planLabel: string;
  overrideBytes: string | null;
  overrideLabel: string | null;
  effectiveLabel: string;
  effectiveSource: "override" | "plan" | "system_default";
};

type CategoryUsage = {
  category: string;
  label: string;
  bytesLabel: string;
  fileCount: number;
};

type PlanOption = {
  plan: "FREE" | "BASIC" | "PRO" | "BUSINESS";
  displayName: string;
};

type CustomerDetail = {
  id: string;
  name: string | null;
  email: string;
  status: "Active" | "Locked";
  assignedPlan: PlanOption["plan"];
  assignedPlanLabel: string;
  storageUsedLabel: string;
  storageLimits: LimitLayerView;
  maxFileSizeLimits: LimitLayerView;
  bandwidthLimits: LimitLayerView;
  lockReason: string | null;
  categories: CategoryUsage[];
};

type AdminCustomerDetailPanelProps = {
  customer: CustomerDetail;
  plans: PlanOption[];
};

const GIB = 1024 * 1024 * 1024;

function bytesToGiBInput(bytes: string | null | undefined): string {
  if (!bytes) {
    return "";
  }
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

function LimitLayerTable({
  title,
  layers,
}: {
  title: string;
  layers: LimitLayerView;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h4 className="text-sm font-medium">{title}</h4>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">Plan limit</dt>
          <dd className="font-medium">{layers.planLabel}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Override</dt>
          <dd className="font-medium">{layers.overrideLabel ?? "None"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Effective</dt>
          <dd className="font-medium">
            {layers.effectiveLabel}
            <span className="ml-2 text-xs text-zinc-500">
              ({layers.effectiveSource.replaceAll("_", " ")})
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function AdminCustomerDetailPanel({
  customer,
  plans,
}: AdminCustomerDetailPanelProps) {
  const router = useRouter();
  const [assignedPlan, setAssignedPlan] = useState(customer.assignedPlan);
  const [useStorageOverride, setUseStorageOverride] = useState(
    customer.storageLimits.overrideBytes !== null,
  );
  const [storageOverrideGiB, setStorageOverrideGiB] = useState(
    bytesToGiBInput(customer.storageLimits.overrideBytes),
  );
  const [useMaxFileOverride, setUseMaxFileOverride] = useState(
    customer.maxFileSizeLimits.overrideBytes !== null,
  );
  const [maxFileOverrideGiB, setMaxFileOverrideGiB] = useState(
    bytesToGiBInput(customer.maxFileSizeLimits.overrideBytes),
  );
  const [useBandwidthOverride, setUseBandwidthOverride] = useState(
    customer.bandwidthLimits.overrideBytes !== null,
  );
  const [bandwidthOverrideGiB, setBandwidthOverrideGiB] = useState(
    bytesToGiBInput(customer.bandwidthLimits.overrideBytes),
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
      const payload: Record<string, string | null> = {
        assignedPlan,
        storageQuotaOverrideBytes: useStorageOverride
          ? giBInputToBytes(storageOverrideGiB)
          : null,
        maxFileSizeOverrideBytes: useMaxFileOverride
          ? giBInputToBytes(maxFileOverrideGiB)
          : null,
        monthlyBandwidthLimitOverrideBytes: useBandwidthOverride
          ? giBInputToBytes(bandwidthOverrideGiB)
          : null,
      };

      const response = await fetch(`/api/admin/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Unable to save customer allocation");
      }

      setMessage("Customer allocation updated");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save customer allocation",
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
          Plan: {customer.assignedPlanLabel} ({customer.assignedPlan})
        </p>
        <p className="mt-1 text-sm">Storage used: {customer.storageUsedLabel}</p>
        <p className="mt-1 text-sm">Status: {customer.status}</p>
        {customer.lockReason ? (
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">
            Lock reason: {customer.lockReason}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4">
        <LimitLayerTable title="Storage allocation" layers={customer.storageLimits} />
        <LimitLayerTable
          title="Maximum file size"
          layers={customer.maxFileSizeLimits}
        />
        <LimitLayerTable
          title="Monthly bandwidth"
          layers={customer.bandwidthLimits}
        />
      </section>

      <form
        onSubmit={handleSave}
        className="grid gap-4 rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800"
      >
        <h3 className="font-medium">Assign plan and overrides</h3>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Subscription plan</span>
          <select
            value={assignedPlan}
            onChange={(event) =>
              setAssignedPlan(event.target.value as PlanOption["plan"])
            }
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {plans.map((plan) => (
              <option key={plan.plan} value={plan.plan}>
                {plan.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useStorageOverride}
            onChange={(event) => setUseStorageOverride(event.target.checked)}
          />
          <span>Custom storage override (GB)</span>
        </label>
        {useStorageOverride ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={storageOverrideGiB}
            onChange={(event) => setStorageOverrideGiB(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useMaxFileOverride}
            onChange={(event) => setUseMaxFileOverride(event.target.checked)}
          />
          <span>Custom max file override (GB)</span>
        </label>
        {useMaxFileOverride ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={maxFileOverrideGiB}
            onChange={(event) => setMaxFileOverrideGiB(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useBandwidthOverride}
            onChange={(event) => setUseBandwidthOverride(event.target.checked)}
          />
          <span>Custom monthly bandwidth override (GB)</span>
        </label>
        {useBandwidthOverride ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={bandwidthOverrideGiB}
            onChange={(event) => setBandwidthOverrideGiB(event.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save allocation
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
