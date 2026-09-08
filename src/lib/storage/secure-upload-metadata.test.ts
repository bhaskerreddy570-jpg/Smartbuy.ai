import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeSecureUploadSize,
  rejectForbiddenSecureUploadSecrets,
  secureEncryptionMetadataSchema,
} from '@/lib/storage/secure-upload-metadata';

describe('secure upload metadata validation', () => {
  it('accepts valid secure upload metadata without secrets', () => {
    const parsed = secureEncryptionMetadataSchema.parse({
      formatVersion: 'csn1',
      algorithm: 'AES-256-GCM',
      kdf: 'NONE',
      salt: null,
      iv: 'AAAAAAAAAAAAAAAA',
      plaintextSize: 1024,
    });

    assert.equal(computeSecureUploadSize(parsed), 1060n);
  });

  it('rejects forbidden secret fields in upload payloads', () => {
    assert.throws(
      () =>
        rejectForbiddenSecureUploadSecrets({
          fileName: 'secret.txt',
          size: 100,
          passphrase: 'hidden',
        }),
      /SECURE_SECRET_REJECTED/,
    );

    assert.throws(
      () =>
        rejectForbiddenSecureUploadSecrets({
          encryption: {
            key: 'secret',
          },
        }),
      /SECURE_SECRET_REJECTED/,
    );
  });

  it('requires salt for passphrase-based uploads', () => {
    const result = secureEncryptionMetadataSchema.safeParse({
      formatVersion: 'csn1',
      algorithm: 'AES-256-GCM',
      kdf: 'PBKDF2-SHA256',
      salt: null,
      iv: 'AAAAAAAAAAAAAAAA',
      plaintextSize: 100,
    });

    assert.equal(result.success, false);
  });
});
