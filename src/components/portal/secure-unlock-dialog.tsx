"use client";

import { useState } from "react";

type SecureUnlockDialogProps = {
  open: boolean;
  fileName: string;
  usesPassphrase: boolean;
  onCancel: () => void;
  onUnlock: (secret: string) => Promise<void>;
};

export function SecureUnlockDialog({
  open,
  fileName,
  usesPassphrase,
  onCancel,
  onUnlock,
}: SecureUnlockDialogProps) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    try {
      await onUnlock(secret);
      setSecret("");
    } catch (unlockError) {
      setError(
        unlockError instanceof Error
          ? unlockError.message
          : "Unable to unlock this secure file.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Unlock secure file</p>
            <p className="mt-1 text-sm text-slate-600">{fileName}</p>
          </div>
          <span aria-hidden className="text-xl">🔐</span>
        </div>

        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          Secure / Zero-Knowledge. Enter your {usesPassphrase ? "passphrase" : "secure key"} to
          decrypt locally in your browser. CloudStoreNow cannot recover this secret.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          {usesPassphrase ? "Passphrase" : "Secure key"}
        </label>
        <input
          type="password"
          autoComplete="off"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
            onClick={() => void handleUnlock()}
            disabled={busy || !secret.trim()}
          >
            {busy ? "Unlocking..." : "Unlock / Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
