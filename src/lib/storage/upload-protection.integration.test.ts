import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { after, describe, it } from 'node:test';
import { createPlanBasedCustomerLimits } from '@/lib/customer-limits';
import { orm } from '@/lib/db';
import { ensurePlanConfigurationsSeeded } from '@/lib/plan-configuration';
import { ensureCustomerQuotaPersisted } from '@/lib/quota-backfill';
import { createPendingUpload, finalizePendingUpload } from '@/lib/storage/upload-lifecycle';
import { getStorageService, toStorageObjectRef } from '@/lib/storage/storage-service';

const ONE_GIB = 1024n * 1024n * 1024n;
const LEGACY_THIRTY_GIB = 30n * ONE_GIB;
const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

describeIntegration('free storage quota integration', () => {
  const userIds: string[] = [];

  after(async () => {
    for (const userId of userIds) {
      await orm.File.where({ userId }).delete();
      await orm.User.where({ id: userId }).delete();
    }
  });

  it('assigns exactly 1 GiB to new FREE customers', async () => {
    await ensurePlanConfigurationsSeeded();
    const defaults = await createPlanBasedCustomerLimits('FREE');
    const user = await orm.User.create({
      email: `free-new-${randomUUID()}@example.com`,
      name: 'Free New',
      passwordHash: await bcrypt.hash('FreeTest123!', 12),
      assignedPlan: 'FREE',
      storageQuotaOverride: null,
      maxFileSizeOverride: null,
      monthlyBandwidthLimitOverride: null,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });
    userIds.push(user.id);

    assert.equal(defaults.storageQuota, ONE_GIB);
    assert.equal(user.storageQuota, ONE_GIB);
  });

  it('syncs legacy FREE customers without manual override down to 1 GiB', async () => {
    await ensurePlanConfigurationsSeeded();
    const user = await orm.User.create({
      email: `free-legacy-${randomUUID()}@example.com`,
      name: 'Free Legacy',
      passwordHash: await bcrypt.hash('FreeTest123!', 12),
      assignedPlan: 'FREE',
      storageQuotaOverride: null,
      maxFileSizeOverride: null,
      monthlyBandwidthLimitOverride: null,
      storageQuota: LEGACY_THIRTY_GIB,
      storageUsed: BigInt(0),
      maxFileSizeBytes: BigInt(5368709120),
      monthlyBandwidthLimitBytes: BigInt(107374182400),
      monthlyBandwidthUsedBytes: BigInt(0),
      bandwidthPeriodStart: new Date().toISOString(),
    });
    userIds.push(user.id);

    await ensureCustomerQuotaPersisted(user.id);
    const updated = await orm.User.where({ id: user.id })
      .select('storageQuota', 'storageQuotaOverride')
      .first();

    assert.equal(updated?.storageQuotaOverride, null);
    assert.equal(updated?.storageQuota, ONE_GIB);
  });

  it('preserves explicit admin storage overrides', async () => {
    const overrideQuota = 5n * ONE_GIB;
    const user = await orm.User.create({
      email: `free-override-${randomUUID()}@example.com`,
      name: 'Override User',
      passwordHash: await bcrypt.hash('FreeTest123!', 12),
      assignedPlan: 'FREE',
      storageQuotaOverride: overrideQuota,
      maxFileSizeOverride: null,
      monthlyBandwidthLimitOverride: null,
      storageQuota: overrideQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: BigInt(536870912),
      monthlyBandwidthLimitBytes: BigInt(107374182400),
      monthlyBandwidthUsedBytes: BigInt(0),
      bandwidthPeriodStart: new Date().toISOString(),
    });
    userIds.push(user.id);

    await ensureCustomerQuotaPersisted(user.id);
    const updated = await orm.User.where({ id: user.id })
      .select('storageQuota', 'storageQuotaOverride')
      .first();

    assert.equal(updated?.storageQuotaOverride, overrideQuota);
    assert.equal(updated?.storageQuota, overrideQuota);
  });

  it('rejects uploads beyond the effective 1 GiB quota', async () => {
    await ensurePlanConfigurationsSeeded();
    const defaults = await createPlanBasedCustomerLimits('FREE');
    const user = await orm.User.create({
      email: `free-quota-${randomUUID()}@example.com`,
      name: 'Quota Enforcement',
      passwordHash: await bcrypt.hash('FreeTest123!', 12),
      assignedPlan: 'FREE',
      storageQuotaOverride: null,
      maxFileSizeOverride: null,
      monthlyBandwidthLimitOverride: null,
      storageQuota: defaults.storageQuota,
      storageUsed: ONE_GIB - 64n,
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });
    userIds.push(user.id);

    const pending = await createPendingUpload({
      userId: user.id,
      fileName: 'too-large.bin',
      originalName: 'too-large.bin',
      mimeType: 'application/octet-stream',
      uploadSize: 128n,
      category: 'OTHER',
    });

    assert.equal(pending.ok, false);
    if (pending.ok) {
      return;
    }
    assert.equal(pending.reason, 'quota_exceeded');
  });
});

describeIntegration('upload duplicate protection integration', () => {
  let userId = '';

  after(async () => {
    if (!userId) {
      return;
    }
    const files = await orm.File.where({ userId }).all();
    for (const file of files) {
      await getStorageService()
        .deleteObject(toStorageObjectRef(file))
        .catch(() => undefined);
    }
    await orm.File.where({ userId }).delete();
    await orm.User.where({ id: userId }).delete();
  });

  it('handles concurrent create and finalize requests idempotently', async () => {
    const email = `upload-dup-${randomUUID()}@example.com`;
    const defaults = await createPlanBasedCustomerLimits('FREE');
    const user = await orm.User.create({
      email,
      name: 'Duplicate Upload Test',
      passwordHash: await bcrypt.hash('UploadTest123!', 12),
      assignedPlan: 'FREE',
      storageQuotaOverride: null,
      maxFileSizeOverride: null,
      monthlyBandwidthLimitOverride: null,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });
    userId = user.id;
    const clientUploadId = randomUUID();

    const creates = await Promise.all(
      Array.from({ length: 5 }, () =>
        createPendingUpload({
          userId,
          fileName: 'concurrent.txt',
          originalName: 'concurrent.txt',
          mimeType: 'text/plain',
          uploadSize: BigInt(64),
          category: 'DOCUMENTS',
          clientUploadId,
        }),
      ),
    );

    assert.ok(creates.every((entry) => entry.ok));
    const fileIds = new Set(
      creates
        .filter((entry) => entry.ok)
        .map((entry) => (entry.ok ? entry.file.fileId : '')),
    );
    assert.equal(fileIds.size, 1);

    const fileId = [...fileIds][0]!;
    const stored = await orm.File.where({ id: fileId }).first();
    assert.ok(stored);

    await getStorageService().putObject({
      objectRef: toStorageObjectRef(stored),
      body: Buffer.alloc(64),
      size: 64n,
    });

    const finalizations = await Promise.all(
      Array.from({ length: 5 }, () =>
        finalizePendingUpload({
          userId,
          fileId,
          actualSize: 64n,
        }),
      ),
    );

    assert.ok(finalizations.every((entry) => entry.ok));
    const readyCount = finalizations.filter(
      (entry) => entry.ok && entry.alreadyComplete,
    ).length;
    assert.ok(readyCount >= 4);

    const rows = await orm.File.where({ userId, clientUploadId }).all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, 'READY');
  });

  it('reuses pending upload and finalizes once after simulated retry', async () => {
    const email = `upload-retry-${randomUUID()}@example.com`;
    const defaults = await createPlanBasedCustomerLimits('FREE');
    const user = await orm.User.create({
      email,
      name: 'Retry Upload Test',
      passwordHash: await bcrypt.hash('UploadTest123!', 12),
      assignedPlan: 'FREE',
      storageQuotaOverride: null,
      maxFileSizeOverride: null,
      monthlyBandwidthLimitOverride: null,
      storageQuota: defaults.storageQuota,
      storageUsed: BigInt(0),
      maxFileSizeBytes: defaults.maxFileSizeBytes,
      monthlyBandwidthLimitBytes: defaults.monthlyBandwidthLimitBytes,
      monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
      bandwidthPeriodStart: defaults.bandwidthPeriodStart,
    });
    userId = user.id;
    const clientUploadId = randomUUID();

    const firstCreate = await createPendingUpload({
      userId,
      fileName: 'retry.txt',
      originalName: 'retry.txt',
      mimeType: 'text/plain',
      uploadSize: BigInt(96),
      category: 'DOCUMENTS',
      clientUploadId,
    });
    assert.equal(firstCreate.ok, true);
    if (!firstCreate.ok) {
      return;
    }

    const retryCreate = await createPendingUpload({
      userId,
      fileName: 'retry.txt',
      originalName: 'retry.txt',
      mimeType: 'text/plain',
      uploadSize: BigInt(96),
      category: 'DOCUMENTS',
      clientUploadId,
    });
    assert.equal(retryCreate.ok, true);
    if (!retryCreate.ok) {
      return;
    }
    assert.equal(retryCreate.file.reusedExisting, true);
    assert.equal(retryCreate.file.fileId, firstCreate.file.fileId);

    const stored = await orm.File.where({ id: firstCreate.file.fileId }).first();
    assert.ok(stored);
    await getStorageService().putObject({
      objectRef: toStorageObjectRef(stored),
      body: Buffer.alloc(96),
      size: 96n,
    });

    const firstFinalize = await finalizePendingUpload({
      userId,
      fileId: firstCreate.file.fileId,
      actualSize: 96n,
    });
    const retryFinalize = await finalizePendingUpload({
      userId,
      fileId: firstCreate.file.fileId,
      actualSize: 96n,
    });

    assert.equal(firstFinalize.ok, true);
    assert.equal(retryFinalize.ok, true);
    if (!firstFinalize.ok || !retryFinalize.ok) {
      return;
    }
    assert.equal(retryFinalize.alreadyComplete, true);

    const rows = await orm.File.where({ userId, clientUploadId }).all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.status, 'READY');
  });
});
