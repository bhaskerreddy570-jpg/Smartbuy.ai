"use client";

import { useMemo, useState } from "react";
import {
  encryptSecureFileWithPassphrase,
  encryptSecureFileWithRawKey,
  formatSecureKeyForDisplay,
  generateSecureFileKey,
  parseSecureKeyFromDisplay,
} from "@/lib/crypto/secure-file-crypto";
import { estimateEncryptedSize } from "@/lib/crypto/secure-file-format";
import type { SecureEncryptionMetadata } from "@/lib/crypto/secure-file-format";

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

export function SecureUploadDialog({
  file,
  open,
  onCancel,
  onConfirm,
}: SecureUploadDialogProps) {
  const [mode, setMode] = useState<SecureUploadMode>("generated-key");
  const [passphrase, setPassphrase] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [savedKeyConfirmed, setSavedKeyConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const encryptedEstimate = useMemo(
    () => estimateEncryptedSize(file.size),
    [file.size],
  );

  if (!open) {
    return null;
  }

  function handleGenerateKey() {
    setError(null);
    setGeneratedKey(formatSecureKeyForDisplay(generateSecureFileKey()));
    setSavedKeyConfirmed(false);
  }

  async function handleContinue() {
    setBusy(true);
    setError(null);

    try {
      const plaintext = await file.arrayBuffer();

      if (mode === "generated-key") {
        if (!generatedKey) {
          throw new Error("Generate a secure key and save it before continuing.");
        }
        if (!savedKeyConfirmed) {
          throw new Error("Confirm that you have saved your secure key.");
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

      if (!passphrase.trim()) {
        throw new Error("Enter a passphrase to encrypt this file.");
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Secure upload</p>
            <p className="mt-1 text-sm text-slate-600">
              Encrypt <span className="font-medium">{file.name}</span> in your browser
              before upload. CloudStoreNow stores ciphertext only.
            </p>
          </div>
          <span aria-hidden className="text-xl">🔐</span>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
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
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
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
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={handleGenerateKey}
            >
              Generate secure key
            </button>
            {generatedKey ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-900">
                  Save this key now
                </p>
                <p className="mt-2 break-all font-mono text-sm text-slate-900">
                  {generatedKey}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    onClick={() => navigator.clipboard.writeText(generatedKey)}
                  >
                    Copy key
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
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
                <label className="mt-3 flex items-start gap-2 text-sm text-amber-950">
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
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700">
              Passphrase
            </label>
            <input
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Enter a strong passphrase"
            />
          </div>
        )}

        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          CloudStoreNow cannot recover your secure-file key. Encrypted upload size:
          approximately {encryptedEstimate.toLocaleString()} bytes.
        </p>

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
            onClick={() => void handleContinue()}
            disabled={busy}
          >
            {busy ? "Encrypting..." : "Upload securely"}
          </button>
        </div>
      </div>
    </div>
  );
}
