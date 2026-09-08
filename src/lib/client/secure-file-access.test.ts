import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  decryptSecureDownload,
  SecureCiphertextFetchError,
  SecureDecryptionError,
  SecureKeyDecryptionError,
} from '@/lib/client/secure-file-access';
import {
  encryptSecureFileWithPassphrase,
  encryptSecureFileWithRawKey,
  generatePassphraseSalt,
  generateSecureFileKey,
} from '@/lib/crypto/secure-file-crypto';
import { SECURE_KDF_PBKDF2 } from '@/lib/crypto/secure-file-format';

const projectRoot = join(import.meta.dirname, '..', '..');

describe('secure file access client', () => {
  it('decrypts ciphertext with the same passphrase', async () => {
    const plaintext = new TextEncoder().encode('round-trip access test').buffer;
    const salt = generatePassphraseSalt();
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext,
      passphrase: 'test-passphrase-123',
      salt,
    });

    const decrypted = await decryptSecureDownload({
      ciphertext: encrypted.encryptedBlob,
      encryption: {
        formatVersion: encrypted.metadata.formatVersion,
        algorithm: encrypted.metadata.algorithm,
        kdf: encrypted.metadata.kdf,
        salt: encrypted.metadata.salt,
        iv: encrypted.metadata.iv,
        plaintextSize: encrypted.metadata.plaintextSize.toString(),
        mimeType: 'text/plain',
      },
      keyInput: 'test-passphrase-123',
      fileName: 'note.txt',
    });

    assert.equal(new TextDecoder().decode(decrypted.plaintext), 'round-trip access test');
  });

  it('throws SecureDecryptionError for wrong passphrases', async () => {
    const plaintext = new TextEncoder().encode('wrong passphrase test').buffer;
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext,
      passphrase: 'correct-passphrase',
    });

    await assert.rejects(
      () =>
        decryptSecureDownload({
          ciphertext: encrypted.encryptedBlob,
          encryption: {
            formatVersion: encrypted.metadata.formatVersion,
            algorithm: encrypted.metadata.algorithm,
            kdf: encrypted.metadata.kdf,
            salt: encrypted.metadata.salt,
            iv: encrypted.metadata.iv,
            plaintextSize: encrypted.metadata.plaintextSize.toString(),
            mimeType: 'text/plain',
          },
          keyInput: 'wrong-passphrase',
          fileName: 'note.txt',
        }),
      (error: unknown) => {
        assert.ok(error instanceof SecureDecryptionError);
        assert.match(error.message, /Incorrect passphrase/);
        return true;
      },
    );
  });

  it('throws SecureKeyDecryptionError for wrong generated keys', async () => {
    const plaintext = new TextEncoder().encode('generated key test').buffer;
    const rawKey = generateSecureFileKey();
    const encrypted = await encryptSecureFileWithRawKey({ plaintext, rawKey });

    await assert.rejects(
      () =>
        decryptSecureDownload({
          ciphertext: encrypted.encryptedBlob,
          encryption: {
            formatVersion: encrypted.metadata.formatVersion,
            algorithm: encrypted.metadata.algorithm,
            kdf: encrypted.metadata.kdf,
            salt: encrypted.metadata.salt,
            iv: encrypted.metadata.iv,
            plaintextSize: encrypted.metadata.plaintextSize.toString(),
            mimeType: 'text/plain',
          },
          keyInput: generateSecureFileKey().toString(),
          fileName: 'note.txt',
        }),
      (error: unknown) => {
        assert.ok(error instanceof SecureKeyDecryptionError);
        return true;
      },
    );
  });

  it('fails safely when ciphertext is tampered', async () => {
    const plaintext = new TextEncoder().encode('tamper test').buffer;
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext,
      passphrase: 'tamper-passphrase',
    });

    const tampered = new Uint8Array(encrypted.encryptedBlob);
    tampered[tampered.length - 3] ^= 0xff;

    await assert.rejects(
      () =>
        decryptSecureDownload({
          ciphertext: tampered.buffer,
          encryption: {
            formatVersion: encrypted.metadata.formatVersion,
            algorithm: encrypted.metadata.algorithm,
            kdf: encrypted.metadata.kdf,
            salt: encrypted.metadata.salt,
            iv: encrypted.metadata.iv,
            plaintextSize: encrypted.metadata.plaintextSize.toString(),
            mimeType: 'text/plain',
          },
          keyInput: 'tamper-passphrase',
          fileName: 'note.txt',
        }),
      SecureDecryptionError,
    );
  });

  it('requires salt metadata for passphrase-based files', async () => {
    const plaintext = new TextEncoder().encode('missing salt').buffer;
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext,
      passphrase: 'missing-salt-passphrase',
    });

    await assert.rejects(
      () =>
        decryptSecureDownload({
          ciphertext: encrypted.encryptedBlob,
          encryption: {
            formatVersion: encrypted.metadata.formatVersion,
            algorithm: encrypted.metadata.algorithm,
            kdf: SECURE_KDF_PBKDF2,
            salt: null,
            iv: encrypted.metadata.iv,
            plaintextSize: encrypted.metadata.plaintextSize.toString(),
            mimeType: 'text/plain',
          },
          keyInput: 'missing-salt-passphrase',
          fileName: 'note.txt',
        }),
      (error: unknown) => {
        assert.ok(error instanceof SecureDecryptionError);
        assert.match(error.message, /metadata is incomplete/);
        return true;
      },
    );
  });

  it('fetches ciphertext through same-origin API route instead of presigned S3 fetch', () => {
    const accessSource = readFileSync(
      join(projectRoot, 'lib/client/secure-file-access.ts'),
      'utf8',
    );
    const ciphertextRouteSource = readFileSync(
      join(projectRoot, 'app/api/files/[fileId]/ciphertext/route.ts'),
      'utf8',
    );

    assert.match(accessSource, /fetch\(`\/api\/files\/\$\{fileId\}\/ciphertext`/);
    assert.doesNotMatch(accessSource, /fetch\(params\.payload\.downloadUrl/);
    assert.match(ciphertextRouteSource, /getObjectBody/);
    assert.match(ciphertextRouteSource, /userId: user\.id/);
  });

  it('maps network fetch failures to SecureCiphertextFetchError', () => {
    const error = new SecureCiphertextFetchError();
    assert.match(error.message, /Unable to retrieve the encrypted file/);
  });
});
