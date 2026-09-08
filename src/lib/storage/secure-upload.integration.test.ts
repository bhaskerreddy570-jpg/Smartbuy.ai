import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import {
  encryptSecureFileWithRawKey,
  generateSecureFileKey,
} from '@/lib/crypto/secure-file-crypto';
import { estimateEncryptedSize } from '@/lib/crypto/secure-file-format';
import { orm } from '@/lib/db';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

let pool: Pool;
const createdUserIds = new Set<string>();

async function createCustomer() {
  const id = randomUUID();
  await orm.User.create({
    id,
    email: `secure-upload-${id}@example.com`,
    name: 'Secure Upload Test',
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

describeIntegration('secure upload integration', () => {
  before(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  after(async () => {
    for (const userId of [...createdUserIds]) {
      await cleanupUser(userId);
    }
    await pool.end();
  });

  it('persists secure ciphertext metadata without server-side secrets', async () => {
    const userId = await createCustomer();
    const plaintext = new TextEncoder().encode('secure integration payload').buffer;
    const encrypted = await encryptSecureFileWithRawKey({
      plaintext,
      rawKey: generateSecureFileKey(),
    });

    const requestBody = JSON.stringify({
      fileName: 'secure-note.txt',
      mimeType: 'text/plain',
      size: encrypted.encryptedSize,
      secure: true,
      encryption: encrypted.metadata,
    });

    assert.doesNotMatch(requestBody, /passphrase|encryptionKey|"key"/);

    const fileId = randomUUID();
    const storageKey = `users/${userId}/files/${randomUUID()}`;
    await pool.query(
      `INSERT INTO file (
        id, "userId", name, "originalName", "storageKey", size, "mimeType", status,
        category, "storageProvider", "storageNamespace", "securityMode",
        "encryptionFormatVersion", "encryptionAlgorithm", "encryptionKdf",
        "encryptionSalt", "encryptionIv", "plaintextSize", "updatedAt"
      ) VALUES ($1,$2,'secure-note.txt','secure-note.txt',$3,$4,'text/plain','READY','OTHER','S3','default','SECURE','csn1','AES-256-GCM','NONE',NULL,$5,$6,NOW())`,
      [
        fileId,
        userId,
        storageKey,
        encrypted.encryptedSize.toString(),
        encrypted.metadata.iv,
        encrypted.metadata.plaintextSize.toString(),
      ],
    );

    const row = await pool.query<{ securityMode: string; encryptionIv: string | null }>(
      'SELECT "securityMode", "encryptionIv" FROM file WHERE id = $1',
      [fileId],
    );

    assert.equal(row.rows[0]?.securityMode, 'SECURE');
    assert.equal(row.rows[0]?.encryptionIv, encrypted.metadata.iv);
    assert.equal(
      BigInt(encrypted.encryptedSize),
      BigInt(estimateEncryptedSize(encrypted.metadata.plaintextSize)),
    );
  });
});
