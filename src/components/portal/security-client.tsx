"use client";

import { signOut } from "next-auth/react";
import { FormEvent, useState } from "react";

function ConnectedDevicesPanel({
  initialDevices,
}: {
  initialDevices: Array<{
    id: string;
    displayName: string;
    platform: "ANDROID" | "IOS";
    lastSyncAt: string | null;
    revokedAt: string | null;
  }>;
}) {
  const [devices, setDevices] = useState(initialDevices);
  const [error, setError] = useState<string | null>(null);

  async function revokeDevice(deviceId: string) {
    const response = await fetch(`/api/contacts/devices/${deviceId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to revoke device");
      return;
    }
    setDevices((current) =>
      current.map((device) =>
        device.id === deviceId
          ? { ...device, revokedAt: new Date().toISOString() }
          : device,
      ),
    );
  }

  if (error) {
    return <p className="portal-alert-error mt-4">{error}</p>;
  }

  if (devices.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        No connected mobile devices yet.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {devices.map((device) => (
        <div
          key={device.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"
        >
          <div>
            <p className="font-medium">{device.displayName}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {device.platform === "ANDROID" ? "Android" : "iPhone"} · Last sync{" "}
              {device.lastSyncAt ? new Date(device.lastSyncAt).toLocaleString() : "never"}
            </p>
          </div>
          {!device.revokedAt ? (
            <button
              type="button"
              className="portal-danger-button"
              onClick={() => void revokeDevice(device.id)}
            >
              Revoke
            </button>
          ) : (
            <span className="text-sm text-zinc-500">Revoked</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function SecurityClient({
  initialDevices,
}: {
  initialDevices: Array<{
    id: string;
    displayName: string;
    platform: "ANDROID" | "IOS";
    lastSyncAt: string | null;
    revokedAt: string | null;
  }>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/customer/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      setError(
        payload?.error === "invalid_current_password"
          ? "Current password is incorrect"
          : payload?.error === "same_password"
            ? "Choose a different password"
            : payload?.error === "password_mismatch"
              ? "Passwords do not match"
              : "Unable to change password",
      );
      setLoading(false);
      return;
    }

    setMessage("Password updated successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLoading(false);
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Security</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage your password and account security.
          </p>
        </div>
      </div>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Change password</h2>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium">
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          {message ? <p className="portal-alert-success">{message}</p> : null}
          {error ? <p className="portal-alert-error">{error}</p> : null}
          <button type="submit" disabled={loading} className="portal-primary-button">
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Connected mobile devices</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Connect new phones from My Files → Contacts. Revoke a device here to stop contact
          synchronization without deleting backed-up contacts.
        </p>
        <ConnectedDevicesPanel initialDevices={initialDevices} />
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Current session</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          You are signed in on this browser session.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="portal-secondary-button mt-4"
        >
          Sign out
        </button>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Multi-factor authentication</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          MFA is not enabled for customer accounts.
        </p>
      </section>
    </div>
  );
}
