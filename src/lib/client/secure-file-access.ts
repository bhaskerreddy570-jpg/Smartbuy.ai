import {
  base64UrlToBytes,
  decryptSecureFileWithPassphrase,
  decryptSecureFileWithRawKey,
} from '@/lib/crypto/secure-file-crypto';
import { SECURE_KDF_PBKDF2 } from '@/lib/crypto/secure-file-format';

export type SecureDownloadPayload = {
  downloadUrl: string;
  fileName: string;
  securityMode?: 'NORMAL' | 'SECURE';
  encryption?: {
    formatVersion: string | null;
    algorithm: string | null;
    kdf: string | null;
    salt: string | null;
    iv: string | null;
    plaintextSize: string | null;
    mimeType: string;
  };
};

export async function fetchSecureCiphertext(downloadUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error('Unable to download secure file');
  }
  return response.arrayBuffer();
}

export async function decryptSecureDownload(params: {
  ciphertext: ArrayBuffer;
  encryption: NonNullable<SecureDownloadPayload['encryption']>;
  keyInput: string;
  fileName: string;
}): Promise<{ plaintext: ArrayBuffer; mimeType: string; fileName: string }> {
  try {
    if (params.encryption.kdf === SECURE_KDF_PBKDF2) {
      if (!params.encryption.salt) {
        throw new Error('Secure file metadata is incomplete.');
      }

      const plaintext = await decryptSecureFileWithPassphrase({
        encryptedBlob: params.ciphertext,
        passphrase: params.keyInput,
        salt: base64UrlToBytes(params.encryption.salt),
      });

      return {
        plaintext,
        mimeType: params.encryption.mimeType,
        fileName: params.fileName,
      };
    }

    const plaintext = await decryptSecureFileWithRawKey({
      encryptedBlob: params.ciphertext,
      rawKey: base64UrlToBytes(params.keyInput.trim()),
    });

    return {
      plaintext,
      mimeType: params.encryption.mimeType,
      fileName: params.fileName,
    };
  } catch {
    throw new Error('Incorrect key or passphrase. Secure files cannot be recovered without the correct secret.');
  }
}

export function triggerBrowserDownload(params: {
  plaintext: ArrayBuffer;
  fileName: string;
  mimeType: string;
}): void {
  const blob = new Blob([params.plaintext], {
    type: params.mimeType || 'application/octet-stream',
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = params.fileName;
  link.rel = 'noopener noreferrer';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function openSecurePreview(params: {
  plaintext: ArrayBuffer;
  mimeType: string;
}): Promise<string | null> {
  if (!params.mimeType.startsWith('image/')) {
    return null;
  }

  const blob = new Blob([params.plaintext], { type: params.mimeType });
  return URL.createObjectURL(blob);
}

export async function handleSecureFileDownload(params: {
  payload: SecureDownloadPayload;
  keyInput: string;
  preview?: boolean;
}): Promise<{ previewUrl?: string }> {
  const ciphertext = await fetchSecureCiphertext(params.payload.downloadUrl);
  const decrypted = await decryptSecureDownload({
    ciphertext,
    encryption: params.payload.encryption!,
    keyInput: params.keyInput,
    fileName: params.payload.fileName,
  });

  if (params.preview) {
    const previewUrl = await openSecurePreview({
      plaintext: decrypted.plaintext,
      mimeType: decrypted.mimeType,
    });
    if (previewUrl) {
      return { previewUrl };
    }
  }

  triggerBrowserDownload(decrypted);
  return {};
}

export async function handleNormalFileDownload(payload: SecureDownloadPayload): Promise<void> {
  const link = document.createElement('a');
  link.href = payload.downloadUrl;
  link.download = payload.fileName;
  link.rel = 'noopener noreferrer';
  link.click();
}
