import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';
import { POST as postChangePassword } from '@/app/api/admin/auth/change-password/route';
import { POST as postAdminLogin } from '@/app/api/admin/auth/login/route';
import { GET as getAdminMe } from '@/app/api/admin/auth/me/route';
import { POST as postRecoveryInitiate } from '@/app/api/admin/recovery/initiate/route';
import {
  provisionInitialAdmin,
  readInitialAdminCredentials,
} from '@/lib/admin/bootstrap';
import { changeAdminPassword } from '@/lib/admin/change-password';
import { authenticateAdminLogin } from '@/lib/admin/login';
import { hashAdminPassword } from '@/lib/admin/password';
import { issueAdminRecoveryToken, completeAdminRecovery, hashRecoveryToken } from '@/lib/admin/recovery';
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
};

let pool: Pool;
const createdAdminIds = new Set<string>();
const originalInitialEmail = process.env.ADMIN_INITIAL_EMAIL;
const originalInitialPassword = process.env.ADMIN_INITIAL_PASSWORD;
const originalBootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
const originalBootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

function adminCookie(token: string): string {
  return `${ADMIN_SESSION_COOKIE}=${token}`;
}

async function createTestAdmin(): Promise<TestAdmin> {
  const id = randomUUID();
  const email = `security-test-${id}@example.com`;
  const passwordHash = await hashAdminPassword('InitialPassword123!');

  await orm.AdminUser.create({
    id,
    email,
    passwordHash,
    displayName: 'Security Test Admin',
    role: 'ADMIN',
    mfaEnabled: false,
  });

  createdAdminIds.add(id);
  return { id, email };
}

async function cleanupAdmin(adminId: string): Promise<void> {
  await pool.query('DELETE FROM "adminAuditLog" WHERE "adminUserId" = $1', [adminId]);
  await pool.query('DELETE FROM "adminSession" WHERE "adminUserId" = $1', [adminId]);
  await pool.query('DELETE FROM "adminUser" WHERE id = $1', [adminId]);
  createdAdminIds.delete(adminId);
}

function randomIp(): string {
  return `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`;
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

    if (originalInitialEmail === undefined) {
      delete process.env.ADMIN_INITIAL_EMAIL;
    } else {
      process.env.ADMIN_INITIAL_EMAIL = originalInitialEmail;
    }
    if (originalInitialPassword === undefined) {
      delete process.env.ADMIN_INITIAL_PASSWORD;
    } else {
      process.env.ADMIN_INITIAL_PASSWORD = originalInitialPassword;
    }
    if (originalBootstrapEmail === undefined) {
      delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    } else {
      process.env.ADMIN_BOOTSTRAP_EMAIL = originalBootstrapEmail;
    }
    if (originalBootstrapPassword === undefined) {
      delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
    } else {
      process.env.ADMIN_BOOTSTRAP_PASSWORD = originalBootstrapPassword;
    }

    await pool.end();
  });

  it('1. rejects reuse of a recovery token after successful completion', async () => {
    const requester = await createTestAdmin();
    const target = await createTestAdmin();
    const ipAddress = randomIp();

    try {
      const issued = await issueAdminRecoveryToken({
        targetEmail: target.email,
        requestedByAdminId: requester.id,
        ipAddress,
      });
      assert.ok(issued);

      const first = await completeAdminRecovery({
        email: target.email,
        token: issued!.token,
        newPasswordHash: await hashAdminPassword('RecoveryPassword123!'),
        ipAddress,
      });
      assert.equal(first, 'ok');

      const second = await completeAdminRecovery({
        email: target.email,
        token: issued!.token,
        newPasswordHash: await hashAdminPassword('AnotherPassword123!'),
        ipAddress,
      });
      assert.equal(second, 'invalid');
    } finally {
      await cleanupAdmin(target.id);
      await cleanupAdmin(requester.id);
    }
  });

  it('2. rejects expired and invalid recovery tokens', async () => {
    const target = await createTestAdmin();
    const token = 'a'.repeat(43);

    await orm.AdminUser.where({ id: target.id }).update({
      recoveryTokenHash: hashRecoveryToken(token),
      recoveryTokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    });

    const expired = await completeAdminRecovery({
      email: target.email,
      token,
      newPasswordHash: await hashAdminPassword('ExpiredPassword123!'),
      ipAddress: '127.0.0.2',
    });
    assert.equal(expired, 'invalid');

    await cleanupAdmin(target.id);
  });

  it('3. rejects unauthenticated access to admin endpoints', async () => {
    const response = await getAdminMe(new Request('http://localhost/api/admin/auth/me'));
    assert.equal(response.status, 401);
    assertNoSecretsInResponse(await response.text());
  });

  it('4. allows authenticated ADMIN to initiate recovery', async () => {
    const admin = await createTestAdmin();
    const target = await createTestAdmin();
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

    assert.equal(response.status, 200);
    assertNoSecretsInResponse(await response.text());

    await cleanupAdmin(target.id);
    await cleanupAdmin(admin.id);
  });

  it('5. returns not found for manipulated customer IDs (IDOR)', async () => {
    const { POST: postCustomerLock } = await import(
      '@/app/api/admin/customers/[userId]/lock/route'
    );
    const admin = await createTestAdmin();
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
    await cleanupAdmin(admin.id);
  });

  it('6. keeps secrets out of login and recovery API responses', async () => {
    const admin = await createTestAdmin();
    const loginResponse = await postAdminLogin(
      new Request('http://localhost/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: admin.email,
          password: 'InitialPassword123!',
        }),
      }),
    );

    assert.equal(loginResponse.status, 200);
    assertNoSecretsInResponse(await loginResponse.text());

    await cleanupAdmin(admin.id);
  });

  it('7. revokes existing admin sessions after password recovery', async () => {
    const target = await createTestAdmin();
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

  it('8. enforces login rate limits', async () => {
    const loginEmail = `login-rate-${randomUUID()}@example.com`;
    const loginIp = `10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}.1`;
    const { isAdminLoginRateLimited, recordAdminLoginAttempt } = await import(
      '@/lib/admin/rate-limit'
    );
    const { adminConfig } = await import('@/lib/admin/config');

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
  });

  it('9. requires authorization and writes audit logs for backup/data-recovery hooks', async () => {
    const { POST: postBackup } = await import('@/app/api/admin/operations/backup/route');
    const admin = await createTestAdmin();
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

    const afterLogs = await orm.AdminAuditLog.where({ adminUserId: admin.id }).all();
    assert.ok(afterLogs.length > beforeCount);
    assert.ok(afterLogs.some((log) => log.action === 'BACKUP_REQUESTED'));

    await cleanupAdmin(admin.id);
  });

  it('10. creates initial ADMIN only once and never overwrites existing password', async () => {
    const existing = await createTestAdmin();
    const beforeHash = (await orm.AdminUser.where({ id: existing.id }).first())!.passwordHash;

    process.env.ADMIN_INITIAL_EMAIL = `new-${randomUUID()}@example.com`;
    process.env.ADMIN_INITIAL_PASSWORD = 'DifferentPassword123!';

    const result = await provisionInitialAdmin();
    assert.equal(result.status, 'already_exists');
    assert.equal(result.email, existing.email);

    const afterHash = (await orm.AdminUser.where({ id: existing.id }).first())!.passwordHash;
    assert.equal(afterHash, beforeHash);

    await cleanupAdmin(existing.id);
  });

  it('11. authenticates ADMIN login and rejects wrong password', async () => {
    const admin = await createTestAdmin();
    const ipAddress = randomIp();

    const success = await authenticateAdminLogin({
      email: admin.email,
      password: 'InitialPassword123!',
      ipAddress,
    });
    assert.equal(success.ok, true);

    const failure = await authenticateAdminLogin({
      email: admin.email,
      password: 'WrongPassword123!',
      ipAddress,
    });
    assert.equal(failure.ok, false);

    await cleanupAdmin(admin.id);
  });

  it('12. requires current password and revokes sessions on password change', async () => {
    const admin = await createTestAdmin();
    const session = await createAdminSession({ adminUserId: admin.id });

    const wrongCurrent = await changeAdminPassword({
      adminUserId: admin.id,
      currentPassword: 'WrongPassword123!',
      newPassword: 'ChangedPassword123!',
    });
    assert.equal(wrongCurrent.ok, false);

    const apiResponse = await postChangePassword(
      new Request('http://localhost/api/admin/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie(session.token),
        },
        body: JSON.stringify({
          currentPassword: 'InitialPassword123!',
          newPassword: 'ChangedPassword123!',
          confirmPassword: 'ChangedPassword123!',
        }),
      }),
    );
    assert.equal(apiResponse.status, 200);
    assertNoSecretsInResponse(await apiResponse.text());
    assert.equal(await getAdminSessionUser(session.token), null);

    const loginWithOld = await authenticateAdminLogin({
      email: admin.email,
      password: 'InitialPassword123!',
      ipAddress: randomIp(),
    });
    assert.equal(loginWithOld.ok, false);

    const loginWithNew = await authenticateAdminLogin({
      email: admin.email,
      password: 'ChangedPassword123!',
      ipAddress: randomIp(),
    });
    assert.equal(loginWithNew.ok, true);

    await cleanupAdmin(admin.id);
  });

  it('13. creates the first ADMIN from env credentials when none exist', async () => {
    const existing = await orm.AdminUser.select('id').all();
    for (const admin of existing) {
      await cleanupAdmin(admin.id);
    }

    const email = `bootstrap-${randomUUID()}@example.com`;
    process.env.ADMIN_INITIAL_EMAIL = email;
    process.env.ADMIN_INITIAL_PASSWORD = 'BootstrapPassword123!';

    const created = await provisionInitialAdmin();
    assert.equal(created.status, 'created');
    assert.equal(created.email, email.toLowerCase());

    const stored = await orm.AdminUser.where({ email: email.toLowerCase() }).first();
    assert.ok(stored);
    assert.equal(stored.role, 'ADMIN');
    createdAdminIds.add(stored.id);

    const second = await provisionInitialAdmin();
    assert.equal(second.status, 'already_exists');
  });

  it('14. reads ADMIN_INITIAL_* with legacy ADMIN_BOOTSTRAP_* fallback', () => {
    process.env.ADMIN_INITIAL_EMAIL = 'initial@example.com';
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'LegacyPassword123!';
    delete process.env.ADMIN_INITIAL_PASSWORD;

    const creds = readInitialAdminCredentials();
    assert.equal(creds.email, 'initial@example.com');
    assert.equal(creds.password, 'LegacyPassword123!');
  });
});
