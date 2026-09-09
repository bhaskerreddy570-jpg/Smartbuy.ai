import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import {
  base64UrlToBytes,
  decryptSecureFileWithPassphrase,
  encryptSecureFileWithPassphrase,
} from '@/lib/crypto/secure-file-crypto';
import { parseCsn1Header } from '@/lib/crypto/secure-file-format';
import { orm } from '@/lib/db';
import { buildStorageKey } from '@/lib/storage/keys';
import { getStorageService, toStorageObjectRef } from '@/lib/storage/storage-service';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const hasS3 =
  Boolean(process.env.AWS_S3_BUCKET?.trim()) &&
  Boolean(process.env.AWS_ACCESS_KEY_ID?.trim()) &&
  Boolean(process.env.AWS_SECRET_ACCESS_KEY?.trim());
const describeIntegration = hasDatabase && hasS3 ? describe : describe.skip;

let pool: Pool;
const createdUserIds = new Set<string>();
const createdStorageKeys = new Set<string>();

async function createCustomer() {
  const id = randomUUID();
  await orm.User.create({
    id,
    email: `secure-roundtrip-${id}@example.com`,
    name: 'Secure Roundtrip Test',
    passwordHash: 'not-used',
    assignedPlan: 'FREE',
    storageQuotaOverride: null,
    maxFileSizeOverride: null,
    monthlyBandwidthLimitOverride: null,
    storageQuota: BigInt(107374182400),
    storageUsed: BigInt(0),
    maxFileSizeBytes: BigInt(107374182400),
    monthlyBandwidthLimitBytes: BigInt(107374182400),
    monthlyBandwidthUsedBytes: BigInt(0),
    bandwidthPeriodStart: new Date().toISOString(),
  });
  createdUserIds.add(id);
  return id;
}

async function cleanupUser(userId: string) {
  await pool.query('DELETE FROM file WHERE "userId" = $1', [userId]);
  await pool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  createdUserIds.delete(userId);
}

describeIntegration('secure file S3 roundtrip', () => {
  before(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  after(async () => {
    for (const storageKey of [...createdStorageKeys]) {
      await getStorageService()
        .deleteObject({
          provider: 'S3',
          namespace: 'default',
          key: storageKey,
        })
        .catch(() => undefined);
    }

    for (const userId of [...createdUserIds]) {
      await cleanupUser(userId);
    }
    await pool.end();
  });

  it('stores ciphertext in S3 and decrypts after byte-for-byte retrieval', async () => {
    const userId = await createCustomer();
    const passphrase = 'integration-test-passphrase-42';
    const originalBytes = new TextEncoder().encode('secure roundtrip payload').buffer;
    const encrypted = await encryptSecureFileWithPassphrase({
      plaintext: originalBytes,
      passphrase,
    });

    const fileId = randomUUID();
    const objectId = randomUUID();
    const storageKey = buildStorageKey({
      userId,
      objectId,
      category: 'OTHER',
    });
    createdStorageKeys.add(storageKey);

    await getStorageService().putObject({
      objectRef: {
        provider: 'S3',
        namespace: 'default',
        key: storageKey,
      },
      body: Buffer.from(encrypted.encryptedBlob),
      size: BigInt(encrypted.encryptedSize),
    });

    await pool.query(
      `INSERT INTO file (
        id, "userId", name, "originalName", "storageKey", size, "mimeType", status,
        category, "storageProvider", "storageNamespace", "securityMode",
        "encryptionFormatVersion", "encryptionAlgorithm", "encryptionKdf",
        "encryptionSalt", "encryptionIv", "plaintextSize", "updatedAt"
      ) VALUES ($1,$2,'secure-roundtrip.txt','secure-roundtrip.txt',$3,$4,'text/plain','READY','OTHER','S3','default','SECURE','csn1','AES-256-GCM','PBKDF2-SHA256',$5,$6,$7,NOW())`,
      [
        fileId,
        userId,
        storageKey,
        encrypted.encryptedSize.toString(),
        encrypted.metadata.salt,
        encrypted.metadata.iv,
        encrypted.metadata.plaintextSize.toString(),
      ],
    );

    const stored = await orm.File.where({ id: fileId }).first();
    assert.ok(stored);
    assert.equal(stored.securityMode, 'SECURE');
    assert.equal(stored.encryptionSalt, encrypted.metadata.salt);
    assert.doesNotMatch(stored.encryptionSalt ?? '', /integration-test-passphrase-42/);

    const object = await getStorageService().getObjectBody(
      toStorageObjectRef(stored),
    );
    const ciphertext = new Uint8Array(
      object.body.buffer,
      object.body.byteOffset,
      object.body.byteLength,
    ).slice().buffer;

    assert.equal(ciphertext.byteLength, encrypted.encryptedSize);
    assert.notEqual(
      new TextDecoder().decode(new Uint8Array(ciphertext)),
      'secure roundtrip payload',
    );
    assert.doesNotThrow(() => parseCsn1Header(ciphertext));

    const saltBytes = base64UrlToBytes(encrypted.metadata.salt!);

    const decrypted = await decryptSecureFileWithPassphrase({
      encryptedBlob: ciphertext,
      passphrase,
      salt: saltBytes,
    });

    assert.equal(new TextDecoder().decode(decrypted), 'secure roundtrip payload');

    await assert.rejects(
      () =>
        decryptSecureFileWithPassphrase({
          encryptedBlob: ciphertext,
          passphrase: 'wrong-passphrase-value',
          salt: saltBytes,
        }),
      /SECURE_DECRYPTION_FAILED/,
    );

    const tampered = new Uint8Array(ciphertext);
    tampered[tampered.length - 1] = tampered[tampered.length - 1]! ^ 0xff;

    await assert.rejects(
      () =>
        decryptSecureFileWithPassphrase({
          encryptedBlob: tampered.buffer,
          passphrase,
          salt: saltBytes,
        }),
      /SECURE_DECRYPTION_FAILED/,
    );
  });
});
