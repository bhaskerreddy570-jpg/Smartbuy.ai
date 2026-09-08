import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decryptSecureFileWithPassphrase,
  decryptSecureFileWithRawKey,
  encryptSecureFileWithPassphrase,
  encryptSecureFileWithRawKey,
  formatSecureKeyForDisplay,
  generatePassphraseSalt,
  generateSecureFileKey,
  parseSecureKeyFromDisplay,
} from '@/lib/crypto/secure-file-crypto';
import { parseCsn1Header, SECURE_KDF_PBKDF2 } from '@/lib/crypto/secure-file-format';

describe('secure file crypto', () => {
  it('encrypts and decrypts with a generated key', async () => {
    const plaintext = new TextEncoder().encode('zero-knowledge payload').buffer;
    const rawKey = generateSecureFileKey();
    const encrypted = await encryptSecureFileWithRawKey({ plaintext, rawKey });
    const decrypted = await decryptSecureFileWithRawKey({
      encryptedBlob: encrypted.encryptedBlob,
      rawKey,
    });

    assert.equal(new TextDecoder().decode(decrypted), 'zero-knowledge payload');
    assert.equal(encrypted.metadata.kdf, 'NONE');
  });

  it('encrypts and decrypts with a passphrase-derived key', async () => {
    const plaintext = new TextEncoder().encode('passphrase protected').buffer;
    const salt = generatePassphraseSalt();
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext,
      passphrase: 'correct horse battery staple',
      salt,
    });

    assert.equal(encrypted.metadata.kdf, SECURE_KDF_PBKDF2);

    const decrypted = await decryptSecureFileWithPassphrase({
      encryptedBlob: encrypted.encryptedBlob,
      passphrase: 'correct horse battery staple',
      salt,
    });

    assert.equal(new TextDecoder().decode(decrypted), 'passphrase protected');
  });

  it('rejects wrong keys and tampered ciphertext safely', async () => {
    const plaintext = new TextEncoder().encode('tamper test').buffer;
    const rawKey = generateSecureFileKey();
    const encrypted = await encryptSecureFileWithRawKey({ plaintext, rawKey });
    const wrongKey = generateSecureFileKey();

    await assert.rejects(
      () =>
        decryptSecureFileWithRawKey({
          encryptedBlob: encrypted.encryptedBlob,
          rawKey: wrongKey,
        }),
      /SECURE_DECRYPTION_FAILED/,
    );

    const tampered = new Uint8Array(encrypted.encryptedBlob);
    tampered[tampered.length - 1] ^= 0xff;

    await assert.rejects(
      () =>
        decryptSecureFileWithRawKey({
          encryptedBlob: tampered.buffer,
          rawKey,
        }),
      /SECURE_DECRYPTION_FAILED/,
    );
  });

  it('parses the versioned csn1 header', async () => {
    const plaintext = new TextEncoder().encode('header test').buffer;
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext,
      passphrase: 'header-passphrase',
    });

    const header = parseCsn1Header(encrypted.encryptedBlob);
    assert.equal(header.usesPassphrase, true);
    assert.equal(header.iv.length, 12);
  });

  it('round-trips generated key display encoding', () => {
    const rawKey = generateSecureFileKey();
    const encoded = formatSecureKeyForDisplay(rawKey);
    assert.deepEqual(parseSecureKeyFromDisplay(encoded), rawKey);
  });
});
