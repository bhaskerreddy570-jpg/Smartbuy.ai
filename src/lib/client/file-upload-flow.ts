import { estimateEncryptedSize } from '@/lib/crypto/secure-file-format';
import type { SecureEncryptionMetadata } from '@/lib/crypto/secure-file-format';
import {
  encryptSecureFileWithPassphrase,
  encryptSecureFileWithRawKey,
  generatePassphraseSalt,
  generateSecureFileKey,
} from '@/lib/crypto/secure-file-crypto';
import { mapUploadClientError } from '@/lib/storage/upload-api-errors';
import {
  beginClientUpload,
  createClientUploadId,
  endClientUpload,
} from '@/lib/client/upload-inflight';

export type SecureUploadMode = 'generated-key' | 'passphrase';

export type PreparedSecureUpload = {
  encryptedFile: File;
  metadata: SecureEncryptionMetadata;
  generatedKey?: string;
};

export type UploadPreparedResult = {
  fileId: string;
  clientUploadId: string;
  status: 'READY' | 'PENDING';
};

export async function prepareSecureUpload(params: {
  file: File;
  mode: SecureUploadMode;
  passphrase?: string;
  rawKey?: Uint8Array;
}): Promise<PreparedSecureUpload> {
  const plaintext = await params.file.arrayBuffer();

  if (params.mode === 'passphrase') {
    if (!params.passphrase?.trim()) {
      throw new Error('Enter a passphrase to encrypt this file.');
    }

    const salt = generatePassphraseSalt();
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext,
      passphrase: params.passphrase,
      salt,
    });

    return {
      encryptedFile: new File(
        [encrypted.encryptedBlob],
        `${params.file.name}.csn1`,
        { type: 'application/octet-stream' },
      ),
      metadata: encrypted.metadata,
    };
  }

  const rawKey = params.rawKey ?? generateSecureFileKey();
  const encrypted = await encryptSecureFileWithRawKey({
    plaintext,
    rawKey,
  });

  return {
    encryptedFile: new File(
      [encrypted.encryptedBlob],
      `${params.file.name}.csn1`,
      { type: 'application/octet-stream' },
    ),
    metadata: encrypted.metadata,
    generatedKey: undefined,
  };
}

export function estimateSecureEncryptedSize(plaintextBytes: number): number {
  return estimateEncryptedSize(plaintextBytes);
}

export async function uploadPreparedFile(params: {
  originalFile: File;
  payloadFile: File;
  secure: boolean;
  encryption?: SecureEncryptionMetadata;
  clientUploadId?: string;
}): Promise<UploadPreparedResult> {
  const clientUploadId = params.clientUploadId ?? createClientUploadId();

  if (!beginClientUpload(clientUploadId)) {
    throw new Error('An upload is already in progress.');
  }

  try {
    const requestResponse = await fetch('/api/files/upload/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: params.originalFile.name,
        mimeType: params.originalFile.type || 'application/octet-stream',
        size: params.payloadFile.size,
        secure: params.secure,
        encryption: params.encryption,
        clientUploadId,
      }),
    });

    if (!requestResponse.ok) {
      const payload = (await requestResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(mapUploadClientError(payload?.error));
    }

    const { fileId } = (await requestResponse.json()) as { fileId: string };

    const transferForm = new FormData();
    transferForm.append('fileId', fileId);
    transferForm.append('file', params.payloadFile, params.payloadFile.name);

    const transferResponse = await fetch('/api/files/upload/transfer', {
      method: 'POST',
      body: transferForm,
    });

    if (!transferResponse.ok) {
      const payload = (await transferResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(mapUploadClientError(payload?.error));
    }

    const completeResponse = await fetch('/api/files/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, clientUploadId }),
    });

    if (!completeResponse.ok) {
      const payload = (await completeResponse.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(mapUploadClientError(payload?.error));
    }

    const completePayload = (await completeResponse.json()) as {
      fileId: string;
      status: 'READY' | 'PENDING';
    };

    return {
      fileId: completePayload.fileId,
      clientUploadId,
      status: completePayload.status,
    };
  } finally {
    endClientUpload(clientUploadId);
  }
}

export async function uploadNormalFile(
  file: File,
  clientUploadId?: string,
): Promise<UploadPreparedResult> {
  return uploadPreparedFile({
    originalFile: file,
    payloadFile: file,
    secure: false,
    clientUploadId,
  });
}

export { generateSecureFileKey, formatSecureKeyForDisplay } from '@/lib/crypto/secure-file-crypto';
