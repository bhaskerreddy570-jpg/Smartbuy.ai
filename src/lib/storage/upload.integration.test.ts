import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { describe, it } from 'node:test';
import { orm } from '@/lib/db';
import { createDefaultCustomerLimits } from '@/lib/customer-limits';
import { parseStorageKey } from '@/lib/storage/keys';
import { getStorageService, toStorageObjectRef } from '@/lib/storage/storage-service';
import { createPendingUpload, finalizePendingUpload } from '@/lib/storage/upload-lifecycle';
import { mapUploadClientError } from '@/lib/storage/upload-api-errors';

describe('customer upload flow', () => {
  it('persists a server-generated storage key separate from the application file id', async () => {
    const email = `storage-key-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const passwordHash = await bcrypt.hash('UploadTest123!', 12);

    const user = await orm.User.create({
      email,
      name: 'Storage Key Test',
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
      const stored = await orm.File.where({ id: pending.file.fileId }).first();
      assert.ok(stored);
      assert.equal(stored.status, 'PENDING');
      assert.equal(stored.storageKey, pending.file.storageKey);

      const parsed = parseStorageKey(stored.storageKey);
      assert.equal(parsed?.format, 'legacy');
      assert.equal(parsed?.userId, user.id);
      assert.notEqual(parsed?.objectId, stored.id);
      assert.match(stored.storageKey, new RegExp(`users/${user.id}/files/`));
    } finally {
      if (pendingFileId) {
        await orm.File.where({ id: pendingFileId }).delete();
      }
      await orm.User.where({ id: user.id }).delete();
    }
  });

  it('uploads through optional presigned URL and finalizes metadata', async () => {
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
      const stored = await orm.File.where({ id: pending.file.fileId }).first();
      assert.ok(stored);

      const prepared = await getStorageService().prepareUpload({
        userId: user.id,
        objectId: parseStorageKey(stored.storageKey)!.objectId,
        category: stored.category,
        size: 2048n,
        includePresignedUploadUrl: true,
      });

      assert.ok(prepared.uploadUrl?.startsWith('https://'));

      const uploadResponse = await fetch(prepared.uploadUrl!, {
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

      const ready = await orm.File.where({ id: pending.file.fileId }).first();
      assert.equal(ready?.status, 'READY');
      assert.equal(ready?.name, 'sample.jpg');
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

  it('uploads through server-side transfer and finalizes metadata', async () => {
    const email = `transfer-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const passwordHash = await bcrypt.hash('UploadTest123!', 12);

    const user = await orm.User.create({
      email,
      name: 'Transfer Test',
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
        fileName: 'transfer.txt',
        originalName: 'transfer.txt',
        mimeType: 'text/plain',
        uploadSize: 128n,
        category: 'DOCUMENTS',
      });

      assert.equal(pending.ok, true);
      if (!pending.ok) {
        return;
      }

      pendingFileId = pending.file.fileId;
      const stored = await orm.File.where({ id: pending.file.fileId }).first();
      assert.ok(stored);

      await getStorageService().putObject({
        objectRef: toStorageObjectRef(stored),
        body: Buffer.alloc(128),
        size: 128n,
      });

      const finalize = await finalizePendingUpload({
        userId: user.id,
        fileId: pending.file.fileId,
        actualSize: 128n,
      });

      assert.equal(finalize.ok, true);

      const ready = await orm.File.where({ id: pending.file.fileId }).first();
      assert.equal(ready?.status, 'READY');
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

  it('finalizes pending uploads idempotently', async () => {
    const email = `idempotent-${randomUUID()}@example.com`;
    const defaults = createDefaultCustomerLimits();
    const passwordHash = await bcrypt.hash('UploadTest123!', 12);

    const user = await orm.User.create({
      email,
      name: 'Idempotent Test',
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
        fileName: 'once.txt',
        originalName: 'once.txt',
        mimeType: 'text/plain',
        uploadSize: 64n,
        category: 'DOCUMENTS',
      });

      assert.equal(pending.ok, true);
      if (!pending.ok) {
        return;
      }

      pendingFileId = pending.file.fileId;
      const stored = await orm.File.where({ id: pending.file.fileId }).first();
      assert.ok(stored);

      await getStorageService().putObject({
        objectRef: toStorageObjectRef(stored),
        body: Buffer.alloc(64),
        size: 64n,
      });

      const first = await finalizePendingUpload({
        userId: user.id,
        fileId: pending.file.fileId,
        actualSize: 64n,
      });
      const second = await finalizePendingUpload({
        userId: user.id,
        fileId: pending.file.fileId,
        actualSize: 64n,
      });

      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      if (first.ok) {
        assert.equal(first.alreadyComplete, false);
      }
      if (second.ok) {
        assert.equal(second.alreadyComplete, true);
      }
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
