"use client";

import { useMemo, useState } from "react";
import {
  encryptSecureFileWithPassphrase,
  encryptSecureFileWithRawKey,
  formatSecureKeyForDisplay,
  generateSecureFileKey,
  parseSecureKeyFromDisplay,
} from "@/lib/crypto/secure-file-crypto";
import {
  estimateEncryptedSize,
  SECURE_PASSPHRASE_MIN_LENGTH,
  type SecureEncryptionMetadata,
} from "@/lib/crypto/secure-file-format";

type SecureUploadDialogProps = {
  file: File;
  open: boolean;
  onCancel: () => void;
  onConfirm: (result: {
    encryptedFile: File;
    metadata: SecureEncryptionMetadata;
  }) => void;
};

type SecureUploadMode = "generated-key" | "passphrase";

const inputClassName =
  "mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 caret-sky-600 outline-none ring-sky-500/30 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:caret-sky-300";

function SecureUploadDialogContent({
  file,
  onCancel,
  onConfirm,
}: Omit<SecureUploadDialogProps, "open">) {
  const [mode, setMode] = useState<SecureUploadMode>("passphrase");
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [lossAcknowledged, setLossAcknowledged] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [savedKeyConfirmed, setSavedKeyConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const encryptedEstimate = useMemo(
    () => estimateEncryptedSize(file.size),
    [file.size],
  );

  const passphraseReady =
    passphrase.length >= SECURE_PASSPHRASE_MIN_LENGTH &&
    passphrase === confirmPassphrase &&
    lossAcknowledged;

  const generatedKeyReady = Boolean(generatedKey) && savedKeyConfirmed && lossAcknowledged;

  const canUpload =
    !busy && (mode === "passphrase" ? passphraseReady : generatedKeyReady);

  function handleGenerateKey() {
    setError(null);
    setGeneratedKey(formatSecureKeyForDisplay(generateSecureFileKey()));
    setSavedKeyConfirmed(false);
  }

  async function handleContinue() {
    if (!canUpload) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const plaintext = await file.arrayBuffer();

      if (mode === "generated-key") {
        if (!generatedKey) {
          throw new Error("Generate a secure key and save it before continuing.");
        }

        const encrypted = await encryptSecureFileWithRawKey({
          plaintext,
          rawKey: parseSecureKeyFromDisplay(generatedKey),
        });

        onConfirm({
          encryptedFile: new File(
            [encrypted.encryptedBlob],
            `${file.name}.csn1`,
            { type: "application/octet-stream" },
          ),
          metadata: encrypted.metadata,
        });
        return;
      }

      const encrypted = await encryptSecureFileWithPassphrase({
        plaintext,
        passphrase,
      });

      onConfirm({
        encryptedFile: new File(
          [encrypted.encryptedBlob],
          `${file.name}.csn1`,
          { type: "application/octet-stream" },
        ),
        metadata: encrypted.metadata,
      });
    } catch (continueError) {
      setError(
        continueError instanceof Error
          ? continueError.message
          : "Unable to encrypt this file securely.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-card w-full max-w-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-950">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Secure upload 🔐
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            Encrypt <span className="font-medium">{file.name}</span> in your browser
            before upload. CloudStoreNow stores ciphertext only.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          <input
            type="radio"
            name="secure-mode"
            checked={mode === "generated-key"}
            onChange={() => {
              setMode("generated-key");
              setError(null);
            }}
          />
          Create a secure key
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
          <input
            type="radio"
            name="secure-mode"
            checked={mode === "passphrase"}
            onChange={() => {
              setMode("passphrase");
              setError(null);
            }}
          />
          Use my own passphrase
        </label>
      </div>

      {mode === "generated-key" ? (
        <div className="mt-4 space-y-3">
          <button
            type="button"
            className="portal-secondary-button"
            onClick={handleGenerateKey}
          >
            Generate secure key
          </button>
          {generatedKey ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-950 dark:text-amber-100">
                Save this key now
              </p>
              <p className="mt-2 break-all font-mono text-sm text-zinc-900 dark:text-zinc-50">
                {generatedKey}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="portal-secondary-button"
                  onClick={() => navigator.clipboard.writeText(generatedKey)}
                >
                  Copy key
                </button>
                <button
                  type="button"
                  className="portal-secondary-button"
                  onClick={() => {
                    const blob = new Blob([generatedKey], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${file.name}.cloudstorenow-key.txt`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download key
                </button>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm text-amber-950 dark:text-amber-100">
                <input
                  type="checkbox"
                  checked={savedKeyConfirmed}
                  onChange={(event) => setSavedKeyConfirmed(event.target.checked)}
                />
                I have saved my key.
              </label>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Passphrase
            </label>
            <input
              type="password"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              name="secure-file-passphrase"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className={inputClassName}
              placeholder={`At least ${SECURE_PASSPHRASE_MIN_LENGTH} characters`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Confirm passphrase
            </label>
            <input
              type="password"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              data-form-type="other"
              name="secure-file-passphrase-confirm"
              value={confirmPassphrase}
              onChange={(event) => setConfirmPassphrase(event.target.value)}
              className={inputClassName}
              placeholder="Re-enter the same passphrase"
            />
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-200">
            Your passphrase is required to decrypt this file. CloudStoreNow cannot
            recover it.
          </p>
        </div>
      )}

      <label className="mt-4 flex items-start gap-2 text-sm text-zinc-800 dark:text-zinc-100">
        <input
          type="checkbox"
          checked={lossAcknowledged}
          onChange={(event) => setLossAcknowledged(event.target.checked)}
        />
        I understand that if I lose this {mode === "passphrase" ? "passphrase" : "secure key"},
        this secure file cannot be recovered.
      </label>

      <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        Encrypted upload size: approximately {encryptedEstimate.toLocaleString()} bytes.
      </p>

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
          onClick={() => void handleContinue()}
          disabled={!canUpload}
        >
          {busy ? "Encrypting..." : "Upload securely"}
        </button>
      </div>
    </div>
  );
}

export function SecureUploadDialog({
  file,
  open,
  onCancel,
  onConfirm,
}: SecureUploadDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <SecureUploadDialogContent
        key={`${file.name}-${file.size}-${file.lastModified}`}
        file={file}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </div>
  );
}
