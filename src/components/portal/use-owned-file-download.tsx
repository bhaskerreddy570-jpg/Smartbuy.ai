"use client";

import { useState } from "react";
import { SecureUnlockDialog } from "@/components/portal/secure-unlock-dialog";
import {
  handleNormalFileDownload,
  handleSecureFileDownload,
  type SecureDownloadPayload,
} from "@/lib/client/secure-file-access";

export function useOwnedFileDownload() {
  const [unlockTarget, setUnlockTarget] = useState<{
    fileId: string;
    fileName: string;
    usesPassphrase: boolean;
    payload: SecureDownloadPayload;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadFile(fileId: string): Promise<boolean> {
    setDownloadError(null);
    const response = await fetch(`/api/files/${fileId}`);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setDownloadError(
        payload?.error === "BANDWIDTH_LIMIT_EXCEEDED"
          ? "Monthly download limit reached"
          : "Unable to download file",
      );
      return false;
    }

    const payload = (await response.json()) as SecureDownloadPayload;

    if (payload.securityMode === "SECURE" && payload.encryption) {
      setUnlockTarget({
        fileId,
        fileName: payload.fileName,
        usesPassphrase: payload.encryption.kdf === "PBKDF2-SHA256",
        payload: { ...payload, fileId },
      });
      return true;
    }

    await handleNormalFileDownload({ ...payload, fileId });
    return true;
  }

  const unlockDialog = (
    <SecureUnlockDialog
      open={unlockTarget !== null}
      fileName={unlockTarget?.fileName ?? ""}
      usesPassphrase={unlockTarget?.usesPassphrase ?? false}
      onCancel={() => setUnlockTarget(null)}
      onUnlock={async (secret) => {
        if (!unlockTarget) {
          return;
        }
        await handleSecureFileDownload({
          payload: unlockTarget.payload,
          keyInput: secret,
        });
        setUnlockTarget(null);
      }}
    />
  );

  return {
    downloadFile,
    unlockDialog,
    downloadError,
    setDownloadError,
  };
}
