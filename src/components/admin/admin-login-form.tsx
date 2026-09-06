"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      setError("Invalid admin credentials or access denied");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="admin-email" className="mb-1 block text-sm font-medium">
          Admin email
        </label>
        <input
          id="admin-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none ring-amber-600 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          autoComplete="username"
        />
      </div>
      <div>
        <label htmlFor="admin-password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none ring-amber-600 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          autoComplete="current-password"
        />
      </div>
      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-amber-700 px-4 py-3 font-medium text-white transition hover:bg-amber-600 disabled:opacity-60"
      >
        {loading ? "Signing in..." : "Sign in to admin"}
      </button>
    </form>
  );
}
