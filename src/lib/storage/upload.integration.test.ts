import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { describe, it } from 'node:test';
import { orm } from '@/lib/db';
import { createDefaultCustomerLimits } from '@/lib/customer-limits';
import { getStorageService, toStorageObjectRef } from '@/lib/storage/storage-service';
import { createPendingUpload, finalizePendingUpload } from '@/lib/storage/upload-lifecycle';
import { mapUploadClientError } from '@/lib/storage/upload-api-errors';

describe('customer upload flow', () => {
  it('uploads through presigned URL and finalizes metadata', async () => {
    const email = `upload-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const passwordHash = await bcrypt.hash('UploadTest123!', 12);

    const user = await orm.User.create({
      email,
      name: 'Upload Test',
      passwordHash,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });

    let pendingFileId: string | null = null;

    try {
      const pending = await createPendingUpload({
        userId: user.id,
        fileName: 'sample.jpg',
        originalName: 'sample.jpg',
        mimeType: 'image/jpeg',
        uploadSize: 2048n,
        category: 'IMAGES',
      });

      assert.equal(pending.ok, true);
      if (!pending.ok) {
        return;
      }

      pendingFileId = pending.file.fileId;
      assert.match(pending.file.storageKey, new RegExp(`users/${user.id}/files/`));
      assert.ok(pending.file.uploadUrl.startsWith('https://'));

      const uploadResponse = await fetch(pending.file.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: Buffer.alloc(2048),
      });
      assert.ok(uploadResponse.ok, `S3 upload failed with ${uploadResponse.status}`);

      const finalize = await finalizePendingUpload({
        userId: user.id,
        fileId: pending.file.fileId,
        actualSize: 2048n,
      });

      assert.equal(finalize.ok, true);

      const stored = await orm.File.where({ id: pending.file.fileId }).first();
      assert.equal(stored?.status, 'READY');
      assert.equal(stored?.name, 'sample.jpg');
    } finally {
      if (pendingFileId) {
        const stored = await orm.File.where({ id: pendingFileId }).first();
        if (stored) {
          await getStorageService()
            .deleteObject(toStorageObjectRef(stored))
            .catch(() => undefined);
        }
      }

      await orm.File.where({ userId: user.id }).delete();
      await orm.User.where({ id: user.id }).delete();
    }
  });

  it('maps upload API errors to customer-safe messages', () => {
    assert.equal(mapUploadClientError('STORAGE_QUOTA_EXCEEDED'), 'Storage limit reached');
    assert.equal(
      mapUploadClientError('FILE_SIZE_LIMIT_EXCEEDED'),
      'File exceeds your maximum file size.',
    );
    assert.equal(mapUploadClientError('USER_NOT_FOUND'), 'Account not found. Please sign in again.');
    assert.equal(
      mapUploadClientError('STORAGE_UNAVAILABLE'),
      'Unable to prepare upload. Please try again.',
    );
    assert.notEqual(mapUploadClientError('USER_NOT_FOUND'), 'Not found');
  });
});
