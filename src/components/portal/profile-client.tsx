"use client";

import { FormEvent, useState } from "react";
import type { ProfileData } from "@/lib/portal/data";

type ProfileClientProps = {
  initialData: ProfileData;
};

export function ProfileClient({ initialData }: ProfileClientProps) {
  const [data, setData] = useState(initialData);
  const [name, setName] = useState(initialData.user.name ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/customer/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      setError("Unable to update profile");
      setSaving(false);
      return;
    }

    const payload = (await response.json()) as ProfileData;
    setData(payload);
    setMessage("Profile updated");
    setSaving(false);
  }

  const initials = (data.user.name ?? data.user.email)
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Profile</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Your account details and storage plan.
          </p>
        </div>
      </div>

      <section className="portal-card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-sky-500 to-indigo-600 text-2xl font-semibold text-white shadow-lg shadow-sky-500/20">
            {initials || "U"}
          </span>
          <div>
            <p className="text-xl font-semibold">{data.user.name ?? "Account"}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{data.user.email}</p>
            <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {data.user.status}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="portal-card">
          <h2 className="text-lg font-semibold">Account</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="mt-1 font-medium">{data.user.email}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Role</dt>
              <dd className="mt-1 font-medium">{data.user.role}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Member since</dt>
              <dd className="mt-1 font-medium">
                {new Date(data.user.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Plan</dt>
              <dd className="mt-1 font-medium">{data.plan}</dd>
            </div>
          </dl>
        </section>

        <section className="portal-card">
          <h2 className="text-lg font-semibold">Storage</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Used</dt>
              <dd className="mt-1 font-medium">{data.storage.usedLabel}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Limit</dt>
              <dd className="mt-1 font-medium">{data.storage.quotaLabel}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Remaining</dt>
              <dd className="mt-1 font-medium">{data.storage.remainingLabel}</dd>
            </div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Max file size</dt>
              <dd className="mt-1 font-medium">{data.maxFileSizeLabel}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Edit profile</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">
              Full name
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          {message ? <p className="portal-alert-success">{message}</p> : null}
          {error ? <p className="portal-alert-error">{error}</p> : null}
          <button type="submit" disabled={saving} className="portal-primary-button">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </section>
    </div>
  );
}
