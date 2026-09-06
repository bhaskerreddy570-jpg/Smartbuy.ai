"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    const response = await fetch("/api/admin/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      setError("Unable to change password. Check your current password and try again.");
      return;
    }

    setSuccess("Password changed successfully. Redirecting to sign in...");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    window.setTimeout(() => {
      router.push("/admin/login");
      router.refresh();
    }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
      <div>
        <label htmlFor="current-password" className="mb-1 block text-sm font-medium">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          autoComplete="current-password"
        />
      </div>
      <div>
        <label htmlFor="new-password" className="mb-1 block text-sm font-medium">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={12}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-zinc-500">
          At least 12 characters with one letter and one number.
        </p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          minLength={12}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          autoComplete="new-password"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-amber-700 px-4 py-2 font-medium text-white transition hover:bg-amber-800 disabled:opacity-60"
      >
        {submitting ? "Changing password..." : "Change password"}
      </button>
    </form>
  );
}
