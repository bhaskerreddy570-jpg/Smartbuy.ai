import {
  CSN1_FLAG_PASSPHRASE,
  CSN1_GCM_TAG_SIZE,
  CSN1_HEADER_SIZE,
  CSN1_IV_SIZE,
  CSN1_KEY_BYTES,
  CSN1_MAGIC,
  CSN1_SALT_BYTES,
  CSN1_VERSION_BYTE,
  PBKDF2_ITERATIONS,
  SECURE_ALGORITHM,
  SECURE_KDF_NONE,
  SECURE_KDF_PBKDF2,
  estimateEncryptedSize,
  parseCsn1Header,
  type SecureEncryptionMetadata,
} from '@/lib/crypto/secure-file-format';

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto is unavailable');
  }
  return subtle;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function generateSecureFileKey(): Uint8Array {
  return randomBytes(CSN1_KEY_BYTES);
}

export function formatSecureKeyForDisplay(key: Uint8Array): string {
  return bytesToBase64Url(key);
}

export function parseSecureKeyFromDisplay(value: string): Uint8Array {
  const bytes = base64UrlToBytes(value.trim());
  if (bytes.length !== CSN1_KEY_BYTES) {
    throw new Error('SECURE_KEY_INVALID');
  }
  return bytes;
}

export function generatePassphraseSalt(): Uint8Array {
  return randomBytes(CSN1_SALT_BYTES);
}

function toBufferSource(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function importAesGcmKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return getSubtleCrypto().importKey(
    'raw',
    toBufferSource(rawKey),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  if (!passphrase.trim()) {
    throw new Error('SECURE_PASSPHRASE_REQUIRED');
  }

  const baseKey = await getSubtleCrypto().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  );

  return getSubtleCrypto().deriveKey(
    {
      name: 'PBKDF2',
      salt: toBufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function importRawSecureKey(rawKey: Uint8Array): Promise<CryptoKey> {
  if (rawKey.length !== CSN1_KEY_BYTES) {
    throw new Error('SECURE_KEY_INVALID');
  }
  return importAesGcmKey(rawKey);
}

function buildCsn1Header(iv: Uint8Array, usesPassphrase: boolean): Uint8Array {
  const header = new Uint8Array(CSN1_HEADER_SIZE);
  header.set(CSN1_MAGIC, 0);
  header[4] = CSN1_VERSION_BYTE;
  header[5] = usesPassphrase ? CSN1_FLAG_PASSPHRASE : 0;
  header.set(iv, 8);
  return header;
}

export async function encryptSecureFile(params: {
  plaintext: ArrayBuffer;
  key: CryptoKey;
  usesPassphrase: boolean;
}): Promise<{
  encryptedBlob: ArrayBuffer;
  iv: Uint8Array;
  encryptedSize: number;
  metadata: SecureEncryptionMetadata;
}> {
  const iv = randomBytes(CSN1_IV_SIZE);
  const ciphertextWithTag = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv: toBufferSource(iv) },
    params.key,
    params.plaintext,
  );

  const header = buildCsn1Header(iv, params.usesPassphrase);
  const encryptedBlob = new Uint8Array(header.length + ciphertextWithTag.byteLength);
  encryptedBlob.set(header, 0);
  encryptedBlob.set(new Uint8Array(ciphertextWithTag), header.length);

  return {
    encryptedBlob: encryptedBlob.buffer,
    iv,
    encryptedSize: encryptedBlob.byteLength,
    metadata: {
      formatVersion: 'csn1',
      algorithm: SECURE_ALGORITHM,
      kdf: params.usesPassphrase ? SECURE_KDF_PBKDF2 : SECURE_KDF_NONE,
      salt: null,
      iv: bytesToBase64Url(iv),
      plaintextSize: params.plaintext.byteLength,
    },
  };
}

export async function encryptSecureFileWithPassphrase(params: {
  plaintext: ArrayBuffer;
  passphrase: string;
  salt?: Uint8Array;
}): Promise<{
  encryptedBlob: ArrayBuffer;
  iv: Uint8Array;
  salt: Uint8Array;
  encryptedSize: number;
  metadata: SecureEncryptionMetadata;
}> {
  const salt = params.salt ?? generatePassphraseSalt();
  const key = await deriveKeyFromPassphrase(params.passphrase, salt);
  const encrypted = await encryptSecureFile({
    plaintext: params.plaintext,
    key,
    usesPassphrase: true,
  });

  return {
    ...encrypted,
    salt,
    metadata: {
      ...encrypted.metadata,
      kdf: SECURE_KDF_PBKDF2,
      salt: bytesToBase64Url(salt),
    },
  };
}

export async function encryptSecureFileWithRawKey(params: {
  plaintext: ArrayBuffer;
  rawKey: Uint8Array;
}): Promise<{
  encryptedBlob: ArrayBuffer;
  iv: Uint8Array;
  encryptedSize: number;
  metadata: SecureEncryptionMetadata;
}> {
  const key = await importRawSecureKey(params.rawKey);
  return encryptSecureFile({
    plaintext: params.plaintext,
    key,
    usesPassphrase: false,
  });
}

export async function decryptSecureFile(params: {
  encryptedBlob: ArrayBuffer;
  key: CryptoKey;
}): Promise<ArrayBuffer> {
  const { iv, ciphertextOffset } = parseCsn1Header(params.encryptedBlob);
  const ciphertext = params.encryptedBlob.slice(ciphertextOffset);

  if (ciphertext.byteLength < CSN1_GCM_TAG_SIZE) {
    throw new Error('SECURE_FORMAT_INVALID');
  }

  try {
    return await getSubtleCrypto().decrypt(
      { name: 'AES-GCM', iv: toBufferSource(iv) },
      params.key,
      ciphertext,
    );
  } catch {
    throw new Error('SECURE_DECRYPTION_FAILED');
  }
}

export async function decryptSecureFileWithPassphrase(params: {
  encryptedBlob: ArrayBuffer;
  passphrase: string;
  salt: Uint8Array;
}): Promise<ArrayBuffer> {
  const key = await deriveKeyFromPassphrase(params.passphrase, params.salt);
  return decryptSecureFile({ encryptedBlob: params.encryptedBlob, key });
}

export async function decryptSecureFileWithRawKey(params: {
  encryptedBlob: ArrayBuffer;
  rawKey: Uint8Array;
}): Promise<ArrayBuffer> {
  const key = await importRawSecureKey(params.rawKey);
  return decryptSecureFile({ encryptedBlob: params.encryptedBlob, key });
}

export function assertPlaintextFitsSecureUpload(plaintextBytes: number, maxFileSizeBytes: bigint): void {
  const encryptedSize = estimateEncryptedSize(plaintextBytes);
  if (BigInt(encryptedSize) > maxFileSizeBytes) {
    throw new Error('SECURE_FILE_TOO_LARGE');
  }
}

export function buildDownloadEncryptionPayload(file: {
  encryptionFormatVersion: string | null;
  encryptionAlgorithm: string | null;
  encryptionKdf: string | null;
  encryptionSalt: string | null;
  encryptionIv: string | null;
  plaintextSize: bigint | number | string | null;
  mimeType: string;
}) {
  return {
    formatVersion: file.encryptionFormatVersion,
    algorithm: file.encryptionAlgorithm,
    kdf: file.encryptionKdf,
    salt: file.encryptionSalt,
    iv: file.encryptionIv,
    plaintextSize: file.plaintextSize?.toString() ?? null,
    mimeType: file.mimeType,
  };
}
