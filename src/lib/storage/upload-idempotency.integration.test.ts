import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { after, describe, it } from 'node:test';
import { orm } from '@/lib/db';
import { createDefaultCustomerLimits } from '@/lib/customer-limits';
import { createPendingUpload, finalizePendingUpload } from '@/lib/storage/upload-lifecycle';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

describeIntegration('upload idempotency integration', () => {
  let userId = '';
  const clientUploadId = randomUUID();

  after(async () => {
    if (!userId) {
      return;
    }
    await orm.File.where({ userId }).delete();
    await orm.User.where({ id: userId }).delete();
  });

  it('reuses the same pending upload for duplicate clientUploadId requests', async () => {
    const email = `upload-idem-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const user = await orm.User.create({
      email,
      name: 'Upload Idempotency',
      passwordHash: await bcrypt.hash('UploadTest123!', 12),
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });
    userId = user.id;

    const first = await createPendingUpload({
      userId,
      fileName: 'notes.txt',
      originalName: 'notes.txt',
      mimeType: 'text/plain',
      uploadSize: BigInt(128),
      category: 'DOCUMENTS',
      clientUploadId,
    });

    const second = await createPendingUpload({
      userId,
      fileName: 'notes.txt',
      originalName: 'notes.txt',
      mimeType: 'text/plain',
      uploadSize: BigInt(128),
      category: 'DOCUMENTS',
      clientUploadId,
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) {
      return;
    }

    assert.equal(first.file.fileId, second.file.fileId);
    assert.equal(second.file.reusedExisting, true);

    const rows = await orm.File.where({ userId, clientUploadId }).all();
    assert.equal(rows.length, 1);

    const finalizedFirst = await finalizePendingUpload({
      userId,
      fileId: first.file.fileId,
      actualSize: BigInt(128),
    });
    const finalizedSecond = await finalizePendingUpload({
      userId,
      fileId: first.file.fileId,
      actualSize: BigInt(128),
    });

    assert.equal(finalizedFirst.ok, true);
    assert.equal(finalizedSecond.ok, true);
    if (!finalizedFirst.ok || !finalizedSecond.ok) {
      return;
    }
    assert.equal(finalizedSecond.alreadyComplete, true);
  });
});
