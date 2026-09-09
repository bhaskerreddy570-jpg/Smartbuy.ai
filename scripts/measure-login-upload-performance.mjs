/**
 * Local staging performance probe — no secrets, synthetic users only.
 * Usage: node --import tsx scripts/measure-login-upload-performance.mjs
 */
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { orm } from '../src/lib/db.ts';
import { createPlanBasedCustomerLimits } from '../src/lib/customer-limits.ts';
import { getDashboardData, getDashboardSummary } from '../src/lib/dashboard.ts';
import { getOverviewData } from '../src/lib/portal/data.ts';
import { listReadyFiles } from '../src/lib/storage/files.ts';
import {
  createPendingUpload,
  finalizePendingUpload,
} from '../src/lib/storage/upload-lifecycle.ts';
import { getStorageService, toStorageObjectRef } from '../src/lib/storage/storage-service.ts';
import { createCustomerSession } from '../src/lib/security/customer-sessions.ts';

async function measure(label, fn) {
  const start = performance.now();
  const result = await fn();
  return { label, ms: Math.round(performance.now() - start), result };
}

async function seedFiles(userId, count) {
  for (let i = 0; i < count; i += 1) {
    const pending = await createPendingUpload({
      userId,
      fileName: `perf-${i}.txt`,
      originalName: `perf-${i}.txt`,
      mimeType: 'text/plain',
      uploadSize: 64n,
      category: 'DOCUMENTS',
    });
    if (!pending.ok) {
      throw new Error(`seed failed: ${pending.reason}`);
    }
    const stored = await orm.File.where({ id: pending.file.fileId }).first();
    await getStorageService().putObject({
      objectRef: toStorageObjectRef(stored),
      body: Buffer.alloc(64),
      size: 64n,
    });
    await finalizePendingUpload({
      userId,
      fileId: pending.file.fileId,
      actualSize: 64n,
    });
  }
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }

  const password = 'PerfProbe123!';
  const passwordHash = await bcrypt.hash(password, 12);
  const defaults = await createPlanBasedCustomerLimits('FREE');
  const user = await orm.User.create({
    email: `perf-probe-${randomUUID()}@example.com`,
    name: 'Perf Probe',
    passwordHash,
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

  const fileCounts = [0, 100, 500];
  const loginRows = [];

  for (const count of fileCounts) {
    if (count > 0) {
      await seedFiles(user.id, count);
    }

    const bcryptMs = (await measure('bcrypt_compare', () => bcrypt.compare(password, passwordHash))).ms;
    const sessionMs = (
      await measure('customer_session_create', () =>
        createCustomerSession({ userId: user.id, ipAddress: '127.0.0.1', userAgent: 'PerfProbe' }),
      )
    ).ms;
    const listAllMs = (await measure('list_ready_files', () => listReadyFiles(user.id))).ms;
    const legacyDashMs = (await measure('get_dashboard_data', () => getDashboardData(user.id))).ms;
    const summaryMs = (await measure('get_dashboard_summary', () => getDashboardSummary(user.id))).ms;
    const overviewMs = (await measure('get_overview_data', () => getOverviewData(user.id))).ms;

    loginRows.push({
      fileCount: count,
      bcrypt_compare_ms: bcryptMs,
      session_create_ms: sessionMs,
      list_all_files_ms: listAllMs,
      get_dashboard_data_ms: legacyDashMs,
      get_dashboard_summary_ms: summaryMs,
      get_overview_data_ms: overviewMs,
    });
  }

  const uploadPendingMs = (
    await measure('create_pending_upload', () =>
      createPendingUpload({
        userId: user.id,
        fileName: 'upload-probe.txt',
        originalName: 'upload-probe.txt',
        mimeType: 'text/plain',
        uploadSize: 256n,
        category: 'DOCUMENTS',
        clientUploadId: randomUUID(),
      }),
    )
  ).ms;

  const pending = await createPendingUpload({
    userId: user.id,
    fileName: 'finalize-probe.txt',
    originalName: 'finalize-probe.txt',
    mimeType: 'text/plain',
    uploadSize: 256n,
    category: 'DOCUMENTS',
    clientUploadId: randomUUID(),
  });
  if (!pending.ok) {
    throw new Error('pending upload failed');
  }
  const stored = await orm.File.where({ id: pending.file.fileId }).first();
  await getStorageService().putObject({
    objectRef: toStorageObjectRef(stored),
    body: Buffer.alloc(256),
    size: 256n,
  });
  const finalizeMs = (
    await measure('finalize_pending_upload', () =>
      finalizePendingUpload({ userId: user.id, fileId: pending.file.fileId, actualSize: 256n }),
    )
  ).ms;

  console.log(
    JSON.stringify(
      {
        environment: 'local_staging_db_not_production',
        login_by_file_count: loginRows,
        upload: {
          create_pending_ms: uploadPendingMs,
          finalize_db_ms: finalizeMs,
        },
        notes: [
          'Portal layout calls auth()+getPortalContext; overview page adds getOverviewData (duplicate ensureCustomerQuotaPersisted mitigated via React cache per request).',
          'bcrypt dominates sign-in latency; file-count-sensitive path is getDashboardData vs summary/overview.',
        ],
      },
      null,
      2,
    ),
  );

  await orm.File.where({ userId: user.id }).delete();
  await orm.CustomerSession.where({ userId: user.id }).delete();
  await orm.CustomerSecurityEvent.where({ userId: user.id }).delete();
  await orm.User.where({ id: user.id }).delete();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
