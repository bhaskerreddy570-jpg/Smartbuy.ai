"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const registered = searchParams.get("registered") === "1";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result) {
        setError("Unable to sign in right now. Please try again.");
        return;
      }

      if (result.error) {
        if (result.error === "Configuration") {
          setError(
            "Sign-in is temporarily unavailable. Please try again later or contact support.",
          );
        } else {
          setError("Invalid email or password");
        }
        return;
      }

      if (!result.ok) {
        setError("Unable to sign in right now. Please try again.");
        return;
      }

      router.push("/overview");
      router.refresh();
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {registered ? (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
          Account created. Sign in to continue.
        </p>
      ) : null}
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none ring-blue-600 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
          autoComplete="email"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none ring-blue-600 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
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
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
