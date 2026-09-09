"use client";

import { signOut } from "next-auth/react";
import { FormEvent, useState } from "react";
import type { SecurityCenterData } from "@/lib/portal/security-data";

function formatWhen(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }
  return new Date(value).toLocaleString();
}

export function SecurityClient({ initialData }: { initialData: SecurityCenterData }) {
  const [data, setData] = useState(initialData);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshSecurityCenter() {
    const response = await fetch("/api/customer/security", { cache: "no-store" });
    if (response.ok) {
      setData((await response.json()) as SecurityCenterData);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) {
      return;
    }

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
    await refreshSecurityCenter();
  }

  async function revokeSession(sessionId: string) {
    const response = await fetch(`/api/customer/sessions/${sessionId}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Unable to revoke session");
      return;
    }
    await refreshSecurityCenter();
  }

  async function revokeOtherSessions() {
    const response = await fetch("/api/customer/sessions/revoke-others", { method: "POST" });
    if (!response.ok) {
      setError("Unable to sign out other sessions");
      return;
    }
    await refreshSecurityCenter();
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="portal-page-header">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Security Center</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Review account security, active sessions, and recent activity.
          </p>
        </div>
      </div>

      {message ? <p className="portal-alert-success">{message}</p> : null}
      {error ? <p className="portal-alert-error">{error}</p> : null}

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Security status</h2>
        <p className="mt-2 text-sm font-medium">
          {data.status.label} — {data.status.description}
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Secure files in your account: {data.secureFileCount}
        </p>
      </section>

      <section className="portal-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Devices &amp; sessions</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Authenticated browser sessions for your CloudStoreNow account.
            </p>
          </div>
          <button type="button" className="portal-secondary-button" onClick={() => void revokeOtherSessions()}>
            Sign out other sessions
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {data.sessions.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No active sessions recorded yet.</p>
          ) : (
            data.sessions.map((session) => (
              <article
                key={session.id}
                className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {session.deviceLabel ?? "Unknown device"}
                      {session.isCurrent ? " · Current session" : ""}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Last active: {formatWhen(session.lastActiveAt)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      First seen: {formatWhen(session.createdAt)}
                    </p>
                  </div>
                  {!session.isCurrent ? (
                    <button
                      type="button"
                      className="portal-danger-button"
                      onClick={() => void revokeSession(session.id)}
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Recent security activity</h2>
        <div className="mt-4 space-y-3">
          {data.events.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No security events recorded yet.</p>
          ) : (
            data.events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700"
              >
                <p className="text-sm font-medium">{event.eventType}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatWhen(event.createdAt)}
                  {event.riskLevel !== "INFO" ? ` · ${event.riskLevel}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {data.storageRecommendations.length > 0 ? (
        <section className="portal-card">
          <h2 className="text-lg font-semibold">Storage recommendations</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Review large files that may be consuming significant space. Nothing is deleted automatically.
          </p>
          <div className="mt-4 space-y-3">
            {data.storageRecommendations.map((item) => (
              <div key={item.id} className="rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-700">
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {item.sizeLabel} · {item.reason}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
          <button type="submit" disabled={loading} className="portal-primary-button">
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>

      <section className="portal-card">
        <h2 className="text-lg font-semibold">Current session</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Sign out of this browser session.
        </p>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="portal-secondary-button mt-4"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
