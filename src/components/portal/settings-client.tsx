"use client";

import Link from "next/link";
import type { ProfileData } from "@/lib/portal/data";

type SettingsClientProps = {
  data: ProfileData;
};

export function SettingsClient({ data }: SettingsClientProps) {
  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your account preferences and storage information.
          </p>
        </div>
      </div>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Profile details</p>
              <p className="text-zinc-500 dark:text-zinc-400">
                Update your name and review account information.
              </p>
            </div>
            <Link href="/profile" className="portal-secondary-button">
              Open profile
            </Link>
          </div>
        </div>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Additional preference controls will appear here as they become available.
        </p>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Email and in-app notification settings are not configurable yet.
        </p>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Storage information</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Storage used</dt>
            <dd className="mt-1 font-medium">{data.storage.usedLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Storage limit</dt>
            <dd className="mt-1 font-medium">{data.storage.quotaLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Monthly download usage</dt>
            <dd className="mt-1 font-medium">{data.bandwidth.usedLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">Monthly download limit</dt>
            <dd className="mt-1 font-medium">{data.bandwidth.limitLabel}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
