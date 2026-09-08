/** CloudStoreNow secure file encryption format (version csn1). */

export const SECURE_FORMAT_VERSION = 'csn1' as const;
export const SECURE_ALGORITHM = 'AES-256-GCM' as const;
export const SECURE_KDF_NONE = 'NONE' as const;
export const SECURE_KDF_PBKDF2 = 'PBKDF2-SHA256' as const;

export const CSN1_HEADER_SIZE = 20;
export const CSN1_IV_SIZE = 12;
export const CSN1_GCM_TAG_SIZE = 16;
export const CSN1_KEY_BYTES = 32;
export const CSN1_SALT_BYTES = 32;

export const CSN1_MAGIC = new Uint8Array([0x43, 0x53, 0x4e, 0x31]); // "CSN1"
export const CSN1_VERSION_BYTE = 0x01;
export const CSN1_FLAG_PASSPHRASE = 0x01;

/** PBKDF2 iteration count (Web Crypto native KDF; see docs/secure-upload-zero-knowledge.md). */
export const PBKDF2_ITERATIONS = 600_000;

export type SecureFileSecurityMode = 'NORMAL' | 'SECURE';

export type SecureEncryptionMetadata = {
  formatVersion: typeof SECURE_FORMAT_VERSION;
  algorithm: typeof SECURE_ALGORITHM;
  kdf: typeof SECURE_KDF_NONE | typeof SECURE_KDF_PBKDF2;
  salt: string | null;
  iv: string;
  plaintextSize: number;
};

export function secureFormatOverheadBytes(): number {
  return CSN1_HEADER_SIZE + CSN1_GCM_TAG_SIZE;
}

export function estimateEncryptedSize(plaintextBytes: number): number {
  return CSN1_HEADER_SIZE + plaintextBytes + CSN1_GCM_TAG_SIZE;
}

export function parseCsn1Header(buffer: ArrayBuffer): {
  iv: Uint8Array;
  ciphertextOffset: number;
  usesPassphrase: boolean;
} {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  if (buffer.byteLength < CSN1_HEADER_SIZE) {
    throw new Error('SECURE_FORMAT_INVALID');
  }

  for (let index = 0; index < CSN1_MAGIC.length; index += 1) {
    if (bytes[index] !== CSN1_MAGIC[index]) {
      throw new Error('SECURE_FORMAT_INVALID');
    }
  }

  if (view.getUint8(4) !== CSN1_VERSION_BYTE) {
    throw new Error('SECURE_FORMAT_UNSUPPORTED');
  }

  const flags = view.getUint8(5);
  const iv = bytes.slice(8, 8 + CSN1_IV_SIZE);

  return {
    iv,
    ciphertextOffset: CSN1_HEADER_SIZE,
    usesPassphrase: (flags & CSN1_FLAG_PASSPHRASE) !== 0,
  };
}
