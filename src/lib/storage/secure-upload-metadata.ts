import { z } from 'zod';
import {
  CSN1_IV_SIZE,
  CSN1_SALT_BYTES,
  SECURE_ALGORITHM,
  SECURE_FORMAT_VERSION,
  SECURE_KDF_NONE,
  SECURE_KDF_PBKDF2,
  estimateEncryptedSize,
  type SecureEncryptionMetadata,
} from '@/lib/crypto/secure-file-format';

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = Buffer.from(normalized + padding, 'base64');
  return new Uint8Array(binary);
}

const forbiddenSecureUploadKeys = [
  'key',
  'passphrase',
  'encryptionKey',
  'password',
  'secret',
  'recoveryKey',
  'decryptionKey',
] as const;

export const secureEncryptionMetadataSchema = z
  .object({
    formatVersion: z.literal(SECURE_FORMAT_VERSION),
    algorithm: z.literal(SECURE_ALGORITHM),
    kdf: z.enum([SECURE_KDF_NONE, SECURE_KDF_PBKDF2]),
    salt: z.union([z.string().regex(base64UrlPattern), z.null()]),
    iv: z.string().regex(base64UrlPattern),
    plaintextSize: z.number().int().positive(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kdf === SECURE_KDF_PBKDF2) {
      if (!value.salt) {
        ctx.addIssue({
          code: 'custom',
          message: 'Salt is required for passphrase-based secure uploads',
          path: ['salt'],
        });
        return;
      }

      try {
        const saltBytes = decodeBase64Url(value.salt);
        if (saltBytes.length !== CSN1_SALT_BYTES) {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid secure upload salt length',
            path: ['salt'],
          });
        }
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid secure upload salt encoding',
          path: ['salt'],
        });
      }
    } else if (value.salt !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Salt must be null for generated-key secure uploads',
        path: ['salt'],
      });
    }

    try {
      const ivBytes = decodeBase64Url(value.iv);
      if (ivBytes.length !== CSN1_IV_SIZE) {
        ctx.addIssue({
          code: 'custom',
          message: 'Invalid secure upload IV length',
          path: ['iv'],
        });
      }
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid secure upload IV encoding',
        path: ['iv'],
      });
    }
  });

export function rejectForbiddenSecureUploadSecrets(body: unknown): void {
  if (!body || typeof body !== 'object') {
    return;
  }

  for (const key of forbiddenSecureUploadKeys) {
    if (key in body) {
      throw new Error('SECURE_SECRET_REJECTED');
    }
  }

  const record = body as Record<string, unknown>;
  const encryption = record.encryption;
  if (encryption && typeof encryption === 'object') {
    for (const key of forbiddenSecureUploadKeys) {
      if (key in (encryption as Record<string, unknown>)) {
        throw new Error('SECURE_SECRET_REJECTED');
      }
    }
  }
}

export function computeSecureUploadSize(metadata: SecureEncryptionMetadata): bigint {
  return BigInt(estimateEncryptedSize(metadata.plaintextSize));
}

export function normalizeSecureEncryptionMetadata(
  metadata: SecureEncryptionMetadata,
): {
  encryptionFormatVersion: string;
  encryptionAlgorithm: string;
  encryptionKdf: string;
  encryptionSalt: string | null;
  encryptionIv: string;
  plaintextSize: bigint;
} {
  return {
    encryptionFormatVersion: metadata.formatVersion,
    encryptionAlgorithm: metadata.algorithm,
    encryptionKdf: metadata.kdf,
    encryptionSalt: metadata.salt,
    encryptionIv: metadata.iv,
    plaintextSize: BigInt(metadata.plaintextSize),
  };
}

export type { SecureEncryptionMetadata } from '@/lib/crypto/secure-file-format';

export function isSecureFileRecord(file: {
  securityMode?: string | null;
}): boolean {
  return file.securityMode === 'SECURE';
}
