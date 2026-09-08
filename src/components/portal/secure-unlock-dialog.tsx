"use client";

import { useState } from "react";

type SecureUnlockDialogProps = {
  open: boolean;
  fileName: string;
  usesPassphrase: boolean;
  onCancel: () => void;
  onUnlock: (secret: string) => Promise<void>;
};

const inputClassName =
  "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 caret-sky-600 outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:caret-sky-300";

function SecureUnlockDialogContent({
  fileName,
  usesPassphrase,
  onCancel,
  onUnlock,
}: Omit<SecureUnlockDialogProps, "open">) {
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    try {
      await onUnlock(secret);
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
    <div className="portal-card w-full max-w-md border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Unlock secure file 🔐
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{fileName}</p>
        </div>
      </div>

      <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
        Secure / Zero-Knowledge. Enter your {usesPassphrase ? "passphrase" : "secure key"} to
        decrypt locally in your browser. CloudStoreNow cannot recover this secret.
      </p>

      <label className="mt-4 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {usesPassphrase ? "Passphrase" : "Secure key"}
      </label>
      <input
        type="password"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
        data-form-type="other"
        name={usesPassphrase ? "secure-file-unlock-passphrase" : "secure-file-unlock-key"}
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        className={inputClassName}
      />

      {error ? (
        <p className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="portal-secondary-button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="portal-primary-button"
          onClick={() => void handleUnlock()}
          disabled={busy || !secret.trim()}
        >
          {busy ? "Unlocking..." : "Unlock / Download"}
        </button>
      </div>
    </div>
  );
}

export function SecureUnlockDialog({
  open,
  fileName,
  usesPassphrase,
  onCancel,
  onUnlock,
}: SecureUnlockDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <SecureUnlockDialogContent
        key={fileName}
        fileName={fileName}
        usesPassphrase={usesPassphrase}
        onCancel={onCancel}
        onUnlock={onUnlock}
      />
    </div>
  );
}
