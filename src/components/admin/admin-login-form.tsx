"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mfaCode: mfaCode || undefined }),
      });

      if (!response.ok) {
        setError(response.status === 429 ? "Too many attempts. Please wait and try again." : "Invalid admin credentials or access denied");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-email" className="mb-1 block text-sm font-medium">Admin email</label>
        <input id="admin-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" autoComplete="username" />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-1 block text-sm font-medium">Password</label>
        <input id="admin-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" autoComplete="current-password" />
      </div>
      <div>
        <label htmlFor="admin-mfa" className="mb-1 block text-sm font-medium">MFA code (if enabled)</label>
        <input id="admin-mfa" type="text" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} className="w-full rounded-xl border border-zinc-300 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950" placeholder="6-digit code" />
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <button type="submit" disabled={loading} className="w-full rounded-xl bg-amber-700 px-4 py-3 font-medium text-white disabled:opacity-60">
        {loading ? "Signing in..." : "Sign in to admin"}
      </button>
    </form>
  );
}
