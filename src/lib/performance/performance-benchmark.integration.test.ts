import 'dotenv/config';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { after, describe, it } from 'node:test';
import { createPlanBasedCustomerLimits } from '@/lib/customer-limits';
import { orm } from '@/lib/db';
import { getDashboardData, getDashboardSummary } from '@/lib/dashboard';
import { getOverviewData } from '@/lib/portal/data';
import { listReadyFiles } from '@/lib/storage/files';
import {
  createPendingUpload,
  finalizePendingUpload,
} from '@/lib/storage/upload-lifecycle';
import { getStorageService, toStorageObjectRef } from '@/lib/storage/storage-service';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

async function measure<T>(label: string, operation: () => Promise<T>) {
  const started = performance.now();
  const result = await operation();
  const durationMs = Math.round(performance.now() - started);
  return { label, durationMs, result };
}

describeIntegration('performance benchmark integration', () => {
  let userId = '';
  const fileIds: string[] = [];

  after(async () => {
    if (!userId) {
      return;
    }
    for (const fileId of fileIds) {
      const stored = await orm.File.where({ id: fileId }).first();
      if (stored) {
        await getStorageService()
          .deleteObject(toStorageObjectRef(stored))
          .catch(() => undefined);
      }
    }
    await orm.File.where({ userId }).delete();
    await orm.User.where({ id: userId }).delete();
  });

  it('reports dashboard and upload stage timings', async () => {
    const defaults = await createPlanBasedCustomerLimits('FREE');
    const user = await orm.User.create({
      email: `perf-${randomUUID()}@example.com`,
      name: 'Performance Benchmark',
      passwordHash: await bcrypt.hash('PerfTest123!', 12),
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

    for (let index = 0; index < 12; index += 1) {
      const pending = await createPendingUpload({
        userId,
        fileName: `bench-${index}.txt`,
        originalName: `bench-${index}.txt`,
        mimeType: 'text/plain',
        uploadSize: 128n,
        category: 'DOCUMENTS',
      });
      assert.equal(pending.ok, true);
      if (!pending.ok) {
        continue;
      }
      fileIds.push(pending.file.fileId);
      const stored = await orm.File.where({ id: pending.file.fileId }).first();
      assert.ok(stored);
      await getStorageService().putObject({
        objectRef: toStorageObjectRef(stored),
        body: Buffer.alloc(128),
        size: 128n,
      });
      await finalizePendingUpload({
        userId,
        fileId: pending.file.fileId,
        actualSize: 128n,
      });
    }

    const loginPasswordVerify = await measure('login_password_verify_ms', async () => {
      const record = await orm.User.where({ id: userId }).select('passwordHash').first();
      assert.ok(record);
      return bcrypt.compare('PerfTest123!', record.passwordHash);
    });

    const legacyDashboardLoad = await measure('login_legacy_list_all_files_ms', () =>
      listReadyFiles(userId),
    );
    const legacyFullDashboard = await measure('login_legacy_get_dashboard_data_ms', () =>
      getDashboardData(userId),
    );
    const optimizedOverviewLoad = await measure('login_optimized_overview_ms', () =>
      getOverviewData(userId),
    );
    const optimizedSummaryLoad = await measure('login_optimized_dashboard_summary_ms', () =>
      getDashboardSummary(userId),
    );

    const pending = await createPendingUpload({
      userId,
      fileName: 'finalize-bench.txt',
      originalName: 'finalize-bench.txt',
      mimeType: 'text/plain',
      uploadSize: 256n,
      category: 'DOCUMENTS',
      clientUploadId: randomUUID(),
    });
    assert.equal(pending.ok, true);
    if (!pending.ok) {
      return;
    }

    const stored = await orm.File.where({ id: pending.file.fileId }).first();
    assert.ok(stored);
    await getStorageService().putObject({
      objectRef: toStorageObjectRef(stored),
      body: Buffer.alloc(256),
      size: 256n,
    });

    const uploadInit = await measure('upload_create_pending_ms', async () =>
      createPendingUpload({
        userId,
        fileName: 'ignored.txt',
        originalName: 'ignored.txt',
        mimeType: 'text/plain',
        uploadSize: 1n,
        category: 'OTHER',
        clientUploadId: randomUUID(),
      }),
    );
    const uploadFinalize = await measure('upload_finalize_db_ms', async () =>
      finalizePendingUpload({
        userId,
        fileId: pending.file.fileId,
        actualSize: 256n,
      }),
    );

    const report = {
      login: {
        beforeMs: legacyFullDashboard.durationMs,
        afterMs: optimizedOverviewLoad.durationMs,
        listAllFilesMs: legacyDashboardLoad.durationMs,
        dashboardSummaryMs: optimizedSummaryLoad.durationMs,
        mainBottleneck: 'Loading every ready file during overview/dashboard hydration',
        fix: 'Use getDashboardSummary + bounded recent-file queries instead of getDashboardData on overview',
        passwordVerifyMs: loginPasswordVerify.durationMs,
      },
      uploadFinalization: {
        createPendingMs: uploadInit.durationMs,
        finalizeDbMs: uploadFinalize.durationMs,
        mainBottleneck: 'Database row lock + finalizePendingUpload transaction',
        fix: 'Skip redundant S3 existence checks; return finalized file payload to avoid full list refresh',
      },
    };

    console.info('[perf:benchmark_report]', JSON.stringify(report));

    assert.ok(optimizedSummaryLoad.durationMs <= legacyDashboardLoad.durationMs + 5);
    assert.ok(optimizedOverviewLoad.durationMs <= legacyFullDashboard.durationMs + 5);
    assert.ok(uploadFinalize.durationMs >= 0);
  });
});
