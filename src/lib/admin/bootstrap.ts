import { randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';
import { hashAdminPassword } from '@/lib/admin/password';
import { revokeAllAdminSessions } from '@/lib/admin/session';

export type ProvisionInitialAdminResult =
  | { status: 'created'; email: string; removedOtherAdmins: number }
  | { status: 'already_exists'; email: string; removedOtherAdmins: number }
  | { status: 'missing_credentials' }
  | { status: 'invalid_credentials'; reason: string };

export function readInitialAdminCredentials(): {
  email: string | null;
  password: string | null;
  displayName: string | null;
} {
  const email =
    process.env.ADMIN_INITIAL_EMAIL?.trim() ||
    process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() ||
    null;
  const password =
    process.env.ADMIN_INITIAL_PASSWORD?.trim() ||
    process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim() ||
    null;
  const displayName =
    process.env.ADMIN_INITIAL_DISPLAY_NAME?.trim() ||
    process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim() ||
    null;

  return { email, password, displayName };
}

function validateInitialAdminPassword(password: string): string | null {
  if (password.length < 12) {
    return 'Initial admin password must be at least 12 characters.';
  }

  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Initial admin password must contain at least one letter and one number.';
  }

  return null;
}

export async function countAdminUsers(): Promise<number> {
  const admins = await orm.AdminUser.select('id').all();
  return admins.length;
}

export async function getAdminUserByEmail(
  email: string,
): Promise<{ id: string; email: string; role: 'ADMIN'; lockedAt: string | null } | null> {
  return orm.AdminUser.where({ email: email.toLowerCase() })
    .select('id', 'email', 'role', 'lockedAt')
    .first();
}

export async function consolidateSingleApplicationAdmin(
  designatedEmail: string,
): Promise<number> {
  const normalizedEmail = designatedEmail.toLowerCase();
  const admins = await orm.AdminUser.select('id', 'email').all();
  let removedOtherAdmins = 0;

  for (const admin of admins) {
    if (admin.email === normalizedEmail) {
      continue;
    }

    await revokeAllAdminSessions(admin.id);
    await orm.AdminUser.where({ id: admin.id }).delete();
    removedOtherAdmins += 1;
  }

  const designatedAdmin = await orm.AdminUser.where({ email: normalizedEmail }).first();
  if (designatedAdmin) {
    const updates: Record<string, string | number | null> = {};

    if (designatedAdmin.role !== 'ADMIN') {
      updates.role = 'ADMIN';
    }
    if (designatedAdmin.lockedAt) {
      updates.lockedAt = null;
      updates.lockReason = null;
      updates.failedLoginAttempts = 0;
      updates.lastFailedLoginAt = null;
    }

    if (Object.keys(updates).length > 0) {
      await orm.AdminUser.where({ id: designatedAdmin.id }).update(updates);
    }
  }

  return removedOtherAdmins;
}

export async function provisionInitialAdmin(): Promise<ProvisionInitialAdminResult> {
  const { email, password, displayName } = readInitialAdminCredentials();

  if (!email) {
    return { status: 'missing_credentials' };
  }

  const normalizedEmail = email.toLowerCase();
  const existingAdmin = await orm.AdminUser.where({ email: normalizedEmail }).first();

  if (existingAdmin) {
    const removedOtherAdmins = await consolidateSingleApplicationAdmin(normalizedEmail);

    return {
      status: 'already_exists',
      email: normalizedEmail,
      removedOtherAdmins,
    };
  }

  if (!password) {
    return { status: 'missing_credentials' };
  }

  const passwordError = validateInitialAdminPassword(password);
  if (passwordError) {
    return {
      status: 'invalid_credentials',
      reason: passwordError,
    };
  }

  const customerAccount = await orm.User.where({ email: normalizedEmail })
    .select('id', 'name')
    .first();

  const passwordHash = await hashAdminPassword(password);

  await orm.AdminUser.create({
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash,
    displayName: displayName ?? customerAccount?.name ?? null,
    role: 'ADMIN',
    mfaEnabled: false,
  });

  const removedOtherAdmins = await consolidateSingleApplicationAdmin(normalizedEmail);

  return { status: 'created', email: normalizedEmail, removedOtherAdmins };
}

export async function resolvePortalUserRole(
  email: string,
): Promise<'USER' | 'ADMIN'> {
  const adminUser = await getAdminUserByEmail(email);
  if (adminUser && adminUser.role === 'ADMIN' && !adminUser.lockedAt) {
    return 'ADMIN';
  }

  return 'USER';
}
