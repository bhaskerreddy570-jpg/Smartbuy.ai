import {
  base64UrlToBytes,
  decryptSecureFileWithPassphrase,
  decryptSecureFileWithRawKey,
} from '@/lib/crypto/secure-file-crypto';
import {
  SecureCiphertextFetchError,
  SecureDecryptionError,
  SecureKeyDecryptionError,
} from '@/lib/crypto/secure-file-errors';
import { SECURE_KDF_PBKDF2 } from '@/lib/crypto/secure-file-format';

export type SecureDownloadPayload = {
  fileId: string;
  downloadUrl?: string;
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

export async function fetchSecureCiphertext(fileId: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(`/api/files/${fileId}/ciphertext`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new SecureCiphertextFetchError();
    }

    return response.arrayBuffer();
  } catch (error) {
    if (error instanceof SecureCiphertextFetchError) {
      throw error;
    }
    throw new SecureCiphertextFetchError();
  }
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
        throw new SecureDecryptionError('Secure file metadata is incomplete.');
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
  } catch (error) {
    if (
      error instanceof SecureDecryptionError ||
      error instanceof SecureKeyDecryptionError
    ) {
      throw error;
    }

    if (params.encryption.kdf === SECURE_KDF_PBKDF2) {
      throw new SecureDecryptionError();
    }

    throw new SecureKeyDecryptionError();
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
  const ciphertext = await fetchSecureCiphertext(params.payload.fileId);
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
  if (!payload.downloadUrl) {
    throw new SecureCiphertextFetchError('Unable to download file.');
  }

  const link = document.createElement('a');
  link.href = payload.downloadUrl;
  link.download = payload.fileName;
  link.rel = 'noopener noreferrer';
  link.click();
}

export {
  SecureCiphertextFetchError,
  SecureDecryptionError,
  SecureKeyDecryptionError,
} from '@/lib/crypto/secure-file-errors';
