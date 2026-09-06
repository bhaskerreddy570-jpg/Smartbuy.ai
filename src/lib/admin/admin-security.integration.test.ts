import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { GET as getAuditLogs } from '@/app/api/admin/audit-logs/route';
import { GET as getAdminMe } from '@/app/api/admin/auth/me/route';
import { POST as postCustomerLock } from '@/app/api/admin/customers/[userId]/lock/route';
import { POST as postBackup } from '@/app/api/admin/operations/backup/route';
import { POST as postDataRecovery } from '@/app/api/admin/operations/data-recovery/route';
import { POST as postRecoveryComplete } from '@/app/api/admin/recovery/complete/route';
import { POST as postRecoveryInitiate } from '@/app/api/admin/recovery/initiate/route';
import { metadataContainsSensitiveValues } from '@/lib/admin/audit-sanitize';
import { adminConfig } from '@/lib/admin/config';
import { hashAdminPassword } from '@/lib/admin/password';
import {
  completeAdminRecovery,
  hashRecoveryToken,
  isRecoveryCompleteRateLimited,
  isRecoveryInitiateRateLimited,
  issueAdminRecoveryToken,
} from '@/lib/admin/recovery';
import {
  isAdminLoginRateLimited,
  recordAdminLoginAttempt,
} from '@/lib/admin/rate-limit';
import { ADMIN_SESSION_COOKIE } from '@/lib/admin/session-cookie';
import {
  createAdminSession,
  getAdminSessionUser,
} from '@/lib/admin/session';
import { orm } from '@/lib/db';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
const describeIntegration = hasDatabase ? describe : describe.skip;

const SENSITIVE_RESPONSE_PATTERN =
  /(?:DATABASE_URL|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID|passwordHash|recoveryTokenHash|cloudstorenow_admin_session=[^;]+)/i;

type TestAdmin = {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
};

let pool: Pool;
const createdAdminIds = new Set<string>();

function adminCookie(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}`;
}

async function createTestAdmin(role: 'ADMIN' | 'SUPER_ADMIN'): Promise<TestAdmin> {
  const id = randomUUID();
  const email = `security-test-${id}@example.com`;
  const passwordHash = await hashAdminPassword('InitialPassword123!');

  await orm.AdminUser.create({
    id,
    email,
    passwordHash,
    displayName: 'Security Test Admin',
    role,
    mfaEnabled: false,
  });

  createdAdminIds.add(id);
  return { id, email, role };
}

async function cleanupAdmin(adminId: string): Promise<void> {
  await pool.query('DELETE FROM "adminAuditLog" WHERE "adminUserId" = $1', [adminId]);
  await pool.query('DELETE FROM "adminSession" WHERE "adminUserId" = $1', [adminId]);
  await pool.query('DELETE FROM "adminUser" WHERE id = $1', [adminId]);
  createdAdminIds.delete(adminId);
}

async function readResponseBody(response: Response): Promise<string> {
  return response.text();
}

function assertNoSecretsInResponse(body: string): void {
  assert.doesNotMatch(body, SENSITIVE_RESPONSE_PATTERN);
}

describeIntegration('admin security integration', () => {
  before(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  after(async () => {
    for (const adminId of [...createdAdminIds]) {
      await cleanupAdmin(adminId);
    }
    await pool.end();
  });

  it('1. rejects reuse of a recovery token after successful completion', async () => {
    const superAdmin = await createTestAdmin('SUPER_ADMIN');
    const target = await createTestAdmin('SUPER_ADMIN');

    const issued = await issueAdminRecoveryToken({
      targetEmail: target.email,
      requestedByAdminId: superAdmin.id,
      ipAddress: '127.0.0.1',
    });
    assert.ok(issued);

    const newPasswordHash = await hashAdminPassword('RecoveryPassword123!');
    const first = await completeAdminRecovery({
      email: target.email,
      token: issued!.token,
      newPasswordHash,
      ipAddress: '127.0.0.1',
    });
    assert.equal(first, 'ok');

    const second = await completeAdminRecovery({
      email: target.email,
      token: issued!.token,
      newPasswordHash: await hashAdminPassword('AnotherPassword123!'),
      ipAddress: '127.0.0.1',
    });
    assert.equal(second, 'invalid');

    await cleanupAdmin(target.id);
    await cleanupAdmin(superAdmin.id);
  });

  it('2. rejects expired and invalid recovery tokens', async () => {
    const target = await createTestAdmin('SUPER_ADMIN');
    const token = 'a'.repeat(43);
    const tokenHash = hashRecoveryToken(token);

    await orm.AdminUser.where({ id: target.id }).update({
      recoveryTokenHash: tokenHash,
      recoveryTokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const expired = await completeAdminRecovery({
      email: target.email,
      token,
      newPasswordHash: await hashAdminPassword('ExpiredPassword123!'),
      ipAddress: '127.0.0.2',
    });
    assert.equal(expired, 'invalid');

    await orm.AdminUser.where({ id: target.id }).update({
      recoveryTokenHash: tokenHash,
      recoveryTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });

    const invalid = await completeAdminRecovery({
      email: target.email,
      token: `${token}x`,
      newPasswordHash: await hashAdminPassword('InvalidPassword123!'),
      ipAddress: '127.0.0.3',
    });
    assert.equal(invalid, 'invalid');

    await cleanupAdmin(target.id);
  });

  it('3. rejects unauthenticated access to admin endpoints', async () => {
    const routes: Array<{ handler: (request: Request, ctx?: unknown) => Promise<Response>; init: RequestInit; ctx?: unknown }> = [
      {
        handler: getAdminMe as (request: Request) => Promise<Response>,
        init: { method: 'GET' },
      },
      {
        handler: getAuditLogs as (request: Request) => Promise<Response>,
        init: { method: 'GET' },
      },
      {
        handler: postRecoveryInitiate as (request: Request) => Promise<Response>,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetEmail: 'nobody@example.com' }),
        },
      },
      {
        handler: postBackup as (request: Request) => Promise<Response>,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'test' }),
        },
      },
      {
        handler: postDataRecovery as (request: Request) => Promise<Response>,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: 'test' }),
        },
      },
      {
        handler: postCustomerLock as (request: Request, ctx: unknown) => Promise<Response>,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'security test lock' }),
        },
        ctx: { params: Promise.resolve({ userId: randomUUID() }) },
      },
    ];

    for (const route of routes) {
      const request = new Request('http://localhost/api/admin/test', route.init);
      const response = route.ctx
        ? await route.handler(request, route.ctx)
        : await route.handler(request);
      assert.equal(response.status, 401, `expected 401 for ${route.init.method}`);
      const body = await readResponseBody(response);
      assertNoSecretsInResponse(body);
    }
  });

  it('4. forbids ADMIN role from SUPER_ADMIN-only recovery initiation', async () => {
    const admin = await createTestAdmin('ADMIN');
    const target = await createTestAdmin('SUPER_ADMIN');
    const session = await createAdminSession({ adminUserId: admin.id });

    const response = await postRecoveryInitiate(
      new Request('http://localhost/api/admin/recovery/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie(session.token),
        },
        body: JSON.stringify({ targetEmail: target.email }),
      }),
    );

    assert.equal(response.status, 403);
    assertNoSecretsInResponse(await readResponseBody(response));

    await cleanupAdmin(target.id);
    await cleanupAdmin(admin.id);
  });

  it('5. returns not found for manipulated customer IDs (IDOR)', async () => {
    const admin = await createTestAdmin('ADMIN');
    const session = await createAdminSession({ adminUserId: admin.id });
    const fakeUserId = randomUUID();

    const response = await postCustomerLock(
      new Request(`http://localhost/api/admin/customers/${fakeUserId}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie(session.token),
        },
        body: JSON.stringify({ reason: 'attempted idor lock' }),
      }),
      { params: Promise.resolve({ userId: fakeUserId }) },
    );

    assert.equal(response.status, 404);
    assertNoSecretsInResponse(await readResponseBody(response));

    await cleanupAdmin(admin.id);
  });

  it('6. keeps recovery tokens, passwords, sessions, and secrets out of API responses and audit metadata', async () => {
    const superAdmin = await createTestAdmin('SUPER_ADMIN');
    const target = await createTestAdmin('SUPER_ADMIN');
    const session = await createAdminSession({ adminUserId: superAdmin.id });

    const initiateResponse = await postRecoveryInitiate(
      new Request('http://localhost/api/admin/recovery/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie(session.token),
        },
        body: JSON.stringify({ targetEmail: target.email }),
      }),
    );

    assert.equal(initiateResponse.status, 200);
    const initiateBody = await readResponseBody(initiateResponse);
    assertNoSecretsInResponse(initiateBody);
    assert.doesNotMatch(initiateBody, /recoveryToken/i);

    const setCookie = initiateResponse.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /HttpOnly/);
    assert.doesNotMatch(initiateBody, /cloudstorenow_recovery_handoff=/);

    const issued = await issueAdminRecoveryToken({
      targetEmail: target.email,
      requestedByAdminId: superAdmin.id,
      ipAddress: '127.0.0.4',
    });
    assert.ok(issued);

    const completeResponse = await postRecoveryComplete(
      new Request('http://localhost/api/admin/recovery/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: target.email,
          token: issued!.token,
          newPassword: 'CompletedRecovery123!',
        }),
      }),
    );

    assert.equal(completeResponse.status, 200);
    assertNoSecretsInResponse(await readResponseBody(completeResponse));

    const logs = await orm.AdminAuditLog.where({ adminUserId: superAdmin.id }).all();
    for (const log of logs) {
      if (log.metadata) {
        const metadata = JSON.parse(log.metadata) as Record<string, unknown>;
        assert.equal(metadataContainsSensitiveValues(metadata), false);
        assert.doesNotMatch(JSON.stringify(metadata), SENSITIVE_RESPONSE_PATTERN);
      }
    }

    await cleanupAdmin(target.id);
    await cleanupAdmin(superAdmin.id);
  });

  it('7. revokes existing admin sessions after password recovery', async () => {
    const target = await createTestAdmin('SUPER_ADMIN');
    const session = await createAdminSession({ adminUserId: target.id });
    assert.ok(await getAdminSessionUser(session.token));

    const issued = await issueAdminRecoveryToken({
      targetEmail: target.email,
      requestedByAdminId: target.id,
      ipAddress: '127.0.0.5',
    });
    assert.ok(issued);

    const result = await completeAdminRecovery({
      email: target.email,
      token: issued!.token,
      newPasswordHash: await hashAdminPassword('PostRecoveryPassword123!'),
      ipAddress: '127.0.0.5',
    });
    assert.equal(result, 'ok');
    assert.equal(await getAdminSessionUser(session.token), null);

    await cleanupAdmin(target.id);
  });

  it('8. enforces login and recovery rate limits', async () => {
    const loginEmail = `login-rate-${randomUUID()}@example.com`;
    const loginIp = `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.1`;

    for (let i = 0; i < adminConfig.loginRateLimitMax; i += 1) {
      await recordAdminLoginAttempt({
        email: loginEmail,
        ipAddress: loginIp,
        success: false,
      });
    }

    assert.equal(
      await isAdminLoginRateLimited({ email: loginEmail, ipAddress: loginIp }),
      true,
    );

    await pool.query('DELETE FROM "adminLoginAttempt" WHERE email = $1', [loginEmail]);

    const superAdmin = await createTestAdmin('SUPER_ADMIN');
    for (let i = 0; i < adminConfig.recoveryInitiateRateLimitMax; i += 1) {
      await orm.AdminAuditLog.create({
        id: randomUUID(),
        adminUserId: superAdmin.id,
        action: 'RECOVERY_TOKEN_ISSUED',
        targetType: 'adminUser',
        targetId: superAdmin.id,
        metadata: null,
        ipAddress: '127.0.0.6',
        userAgent: 'integration-test',
      });
    }

    assert.equal(
      await isRecoveryInitiateRateLimited({ adminUserId: superAdmin.id }),
      true,
    );

    const completeIp = `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.2`;
    for (let i = 0; i < adminConfig.recoveryCompleteRateLimitMax; i += 1) {
      await orm.AdminAuditLog.create({
        id: randomUUID(),
        adminUserId: null,
        action: 'RECOVERY_REQUEST_DENIED',
        targetType: 'adminUser',
        targetId: null,
        metadata: JSON.stringify({ reason: 'integration_rate_limit_seed' }),
        ipAddress: completeIp,
        userAgent: 'integration-test',
      });
    }

    assert.equal(await isRecoveryCompleteRateLimited({ ipAddress: completeIp }), true);

    await pool.query('DELETE FROM "adminAuditLog" WHERE "ipAddress" IN ($1, $2)', [
      '127.0.0.6',
      completeIp,
    ]);
    await cleanupAdmin(superAdmin.id);
  });

  it('9. requires authorization and writes audit logs for backup/data-recovery hooks', async () => {
    const admin = await createTestAdmin('ADMIN');
    const session = await createAdminSession({ adminUserId: admin.id });
    const beforeCount = (await orm.AdminAuditLog.where({ adminUserId: admin.id }).all()).length;

    const backupResponse = await postBackup(
      new Request('http://localhost/api/admin/operations/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie(session.token),
        },
        body: JSON.stringify({ note: 'integration backup request' }),
      }),
    );
    assert.equal(backupResponse.status, 200);
    assertNoSecretsInResponse(await readResponseBody(backupResponse));

    const dataRecoveryResponse = await postDataRecovery(
      new Request('http://localhost/api/admin/operations/data-recovery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie(session.token),
        },
        body: JSON.stringify({ note: 'integration data recovery request' }),
      }),
    );
    assert.equal(dataRecoveryResponse.status, 200);
    assertNoSecretsInResponse(await readResponseBody(dataRecoveryResponse));

    const afterLogs = await orm.AdminAuditLog.where({ adminUserId: admin.id }).all();
    assert.equal(afterLogs.length, beforeCount + 2);
    assert.ok(afterLogs.some((log) => log.action === 'BACKUP_REQUESTED'));
    assert.ok(afterLogs.some((log) => log.action === 'DATA_RECOVERY_REQUESTED'));

    await cleanupAdmin(admin.id);
  });
});
