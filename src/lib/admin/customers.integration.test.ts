import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { PATCH as patchCustomer } from '@/app/api/admin/customers/[userId]/route';
import { GET as listCustomersRoute } from '@/app/api/admin/customers/route';
import { writeAdminAuditLog } from '@/lib/admin/audit';
import { hashAdminPassword } from '@/lib/admin/password';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie';
import { createAdminSession } from '@/lib/admin/session';
import { appConfig } from '@/lib/config';
import { createPlanBasedCustomerLimits } from '@/lib/customer-limits';
import { getDashboardData } from '@/lib/dashboard';
import { orm } from '@/lib/db';
import { exceedsStorageQuota } from '@/lib/storage/quota';
import { reserveBandwidthBytes } from '@/lib/storage/quota-reservation';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

let pool: Pool;
const createdUserIds = new Set<string>();
const createdAdminIds = new Set<string>();

function adminCookie(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}`;
}

async function createAdminSessionHeader(): Promise<string> {
  const adminId = randomUUID();
  const email = `admin-controls-${adminId}@example.com`;
  await orm.AdminUser.create({
    id: adminId,
    email,
    passwordHash: await hashAdminPassword('AdminControls123!'),
    role: 'ADMIN',
    mfaEnabled: false,
  });
  createdAdminIds.add(adminId);
  const session = await createAdminSession({
    adminUserId: adminId,
    ipAddress: '127.0.0.1',
    userAgent: 'integration-test',
  });
  return adminCookie(session.token);
}

async function createCustomer(params?: {
  assignedPlan?: 'FREE' | 'BASIC' | 'PRO' | 'BUSINESS';
  storageQuota?: bigint;
  storageQuotaOverride?: bigint | null;
  maxFileSizeBytes?: bigint;
  maxFileSizeOverride?: bigint | null;
  monthlyBandwidthLimitBytes?: bigint;
  monthlyBandwidthLimitOverride?: bigint | null;
}) {
  const plan = params?.assignedPlan ?? 'FREE';
  const defaults = await createPlanBasedCustomerLimits(plan);
  const id = randomUUID();
  const email = `customer-controls-${id}@example.com`;

  await orm.User.create({
    id,
    email,
    name: 'Controls Test',
    passwordHash: 'not-used',
    assignedPlan: plan,
    storageQuotaOverride: params?.storageQuotaOverride ?? null,
    maxFileSizeOverride: params?.maxFileSizeOverride ?? null,
    monthlyBandwidthLimitOverride: params?.monthlyBandwidthLimitOverride ?? null,
    storageQuota: params?.storageQuota ?? defaults.storageQuota,
    storageUsed: BigInt(0),
    maxFileSizeBytes: params?.maxFileSizeBytes ?? defaults.maxFileSizeBytes,
    monthlyBandwidthLimitBytes:
      params?.monthlyBandwidthLimitBytes ?? defaults.monthlyBandwidthLimitBytes,
    monthlyBandwidthUsedBytes: defaults.monthlyBandwidthUsedBytes,
    bandwidthPeriodStart: defaults.bandwidthPeriodStart,
  });

  createdUserIds.add(id);
  return { id, email };
}

async function cleanupUser(userId: string): Promise<void> {
  await pool.query('DELETE FROM file WHERE "userId" = $1', [userId]);
  await pool.query('DELETE FROM subscription WHERE "userId" = $1', [userId]);
  await pool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  createdUserIds.delete(userId);
}

async function cleanupAdmin(adminId: string): Promise<void> {
  await pool.query('DELETE FROM "adminAuditLog" WHERE "adminUserId" = $1', [adminId]);
  await pool.query('DELETE FROM "adminSession" WHERE "adminUserId" = $1', [adminId]);
  await pool.query('DELETE FROM "adminUser" WHERE id = $1', [adminId]);
  createdAdminIds.delete(adminId);
}

describeIntegration('admin customer controls integration', () => {
  before(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  after(async () => {
    for (const userId of [...createdUserIds]) {
      await cleanupUser(userId);
    }
    for (const adminId of [...createdAdminIds]) {
      await cleanupAdmin(adminId);
    }
    await pool.end();
  });

  it('registers default non-zero customer limits and dashboard labels', async () => {
    const customer = await createCustomer();
    const dashboard = await getDashboardData(customer.id);

    assert.ok(dashboard);
    assert.notEqual(dashboard.storage.quota, '0');
    assert.notEqual(dashboard.storage.quotaLabel, '0 B');
    assert.match(dashboard.storage.quotaLabel, /GB|MB|KB|B/);
    assert.equal(dashboard.bandwidth.limit, appConfig.defaultMonthlyBandwidthLimitBytes.toString());
  });

  it('allows admin to list customers and update limits with audit logging', async () => {
    const cookie = await createAdminSessionHeader();
    const customer = await createCustomer();

    const listResponse = await listCustomersRoute(
      new Request('http://localhost/api/admin/customers', {
        headers: { cookie },
      }),
    );
    assert.equal(listResponse.status, 200);
    const listPayload = (await listResponse.json()) as {
      customers: Array<{ id: string }>;
    };
    assert.ok(listPayload.customers.some((entry) => entry.id === customer.id));

    const nextQuota = (10n * 1024n * 1024n * 1024n).toString();
    const patchResponse = await patchCustomer(
      new Request(`http://localhost/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storageQuotaBytes: nextQuota,
          maxFileSizeBytes: (1n * 1024n * 1024n).toString(),
          monthlyBandwidthLimitBytes: (5n * 1024n * 1024n * 1024n).toString(),
        }),
      }),
      { params: Promise.resolve({ userId: customer.id }) },
    );

    assert.equal(patchResponse.status, 200);
    const updated = await orm.User.where({ id: customer.id })
      .select(
        'storageQuota',
        'storageQuotaOverride',
        'maxFileSizeBytes',
        'maxFileSizeOverride',
        'monthlyBandwidthLimitBytes',
        'monthlyBandwidthLimitOverride',
      )
      .first();
    assert.equal(updated?.storageQuota?.toString(), nextQuota);
    assert.equal(updated?.storageQuotaOverride?.toString(), nextQuota);
    assert.equal(updated?.maxFileSizeBytes?.toString(), (1n * 1024n * 1024n).toString());
    assert.equal(updated?.maxFileSizeOverride?.toString(), (1n * 1024n * 1024n).toString());

    const auditRows = await pool.query<{ action: string }>(
      'SELECT action FROM "adminAuditLog" WHERE "targetId" = $1 ORDER BY "createdAt" DESC',
      [customer.id],
    );
    const actions = auditRows.rows.map((row) => row.action);
    assert.ok(actions.includes('STORAGE_LIMIT_CHANGED'));
    assert.ok(actions.includes('MAX_FILE_SIZE_CHANGED'));
    assert.ok(actions.includes('BANDWIDTH_LIMIT_CHANGED'));
  });

  it('allows admin to assign plans and set custom free-tier storage without payment', async () => {
    const cookie = await createAdminSessionHeader();
    const customer = await createCustomer({ assignedPlan: 'FREE' });
    const customStorage = (30n * 1024n * 1024n * 1024n).toString();

    const storagePatch = await patchCustomer(
      new Request(`http://localhost/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storageQuotaOverrideBytes: customStorage }),
      }),
      { params: Promise.resolve({ userId: customer.id }) },
    );
    assert.equal(storagePatch.status, 200);

    const planPatch = await patchCustomer(
      new Request(`http://localhost/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: {
          cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignedPlan: 'PRO' }),
      }),
      { params: Promise.resolve({ userId: customer.id }) },
    );
    assert.equal(planPatch.status, 200);

    const updated = await orm.User.where({ id: customer.id })
      .select('assignedPlan', 'storageQuotaOverride', 'storageQuota')
      .first();
    assert.equal(updated?.assignedPlan, 'PRO');
    assert.equal(updated?.storageQuotaOverride?.toString(), customStorage);
    assert.equal(updated?.storageQuota?.toString(), customStorage);

    const subscription = await orm.Subscription.where({
      userId: customer.id,
      status: 'ACTIVE',
    })
      .select('plan')
      .first();
    assert.equal(subscription?.plan, 'PRO');

    const auditRows = await pool.query<{ action: string }>(
      'SELECT action FROM "adminAuditLog" WHERE "targetId" = $1 ORDER BY "createdAt" DESC',
      [customer.id],
    );
    const actions = auditRows.rows.map((row) => row.action);
    assert.ok(actions.includes('CUSTOMER_PLAN_CHANGED'));
    assert.ok(actions.includes('STORAGE_LIMIT_CHANGED'));
  });

  it('enforces storage, file-size, and bandwidth limits server-side', async () => {
    await createCustomer({
      storageQuota: 1024n,
      maxFileSizeBytes: 512n,
      monthlyBandwidthLimitBytes: 2048n,
    });

    assert.equal(
      exceedsStorageQuota(900n, 200n, 1024n),
      true,
    );

    const bandwidthReservation = reserveBandwidthBytes(
      {
        storageQuota: 1024n,
        storageUsed: 0n,
        maxFileSizeBytes: 512n,
        monthlyBandwidthLimitBytes: 2048n,
        monthlyBandwidthUsedBytes: 1800n,
        bandwidthPeriodStart: new Date().toISOString(),
      },
      300n,
    );
    assert.equal(bandwidthReservation.ok, false);
  });

  it('does not expose admin customer APIs without an admin session', async () => {
    const customer = await createCustomer();
    const response = await patchCustomer(
      new Request(`http://localhost/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageQuotaBytes: '999' }),
      }),
      { params: Promise.resolve({ userId: customer.id }) },
    );

    assert.equal(response.status, 401);
  });

  it('records customer recovery audit events without secrets', async () => {
    const adminId = randomUUID();
    createdAdminIds.add(adminId);
    await orm.AdminUser.create({
      id: adminId,
      email: `recovery-admin-${adminId}@example.com`,
      passwordHash: await hashAdminPassword('RecoveryAdmin123!'),
      role: 'ADMIN',
      mfaEnabled: false,
    });

    const customer = await createCustomer();
    await writeAdminAuditLog({
      adminUserId: adminId,
      action: 'CUSTOMER_RECOVERY',
      targetType: 'user',
      targetId: customer.id,
      metadata: { note: 'Recovery requested' },
      ipAddress: '127.0.0.1',
    });

    const audit = await pool.query<{ metadata: string | null }>(
      'SELECT metadata FROM "adminAuditLog" WHERE action = $1 AND "targetId" = $2',
      ['CUSTOMER_RECOVERY', customer.id],
    );
    assert.equal(audit.rowCount, 1);
    assert.doesNotMatch(String(audit.rows[0]?.metadata ?? ''), /password|secret|token/i);
  });
});
