import { randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';
import { hashAdminPassword } from '@/lib/admin/password';

export type ProvisionInitialAdminResult =
  | { status: 'created'; email: string }
  | { status: 'already_exists'; email: string }
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

export async function provisionInitialAdmin(): Promise<ProvisionInitialAdminResult> {
  const { email, password, displayName } = readInitialAdminCredentials();

  if (!email) {
    return { status: 'missing_credentials' };
  }

  const normalizedEmail = email.toLowerCase();
  const existingAdmin = await orm.AdminUser.where({ email: normalizedEmail }).first();

  if (existingAdmin) {
    if (existingAdmin.role !== 'ADMIN') {
      await orm.AdminUser.where({ id: existingAdmin.id }).update({ role: 'ADMIN' });
    }

    return {
      status: 'already_exists',
      email: normalizedEmail,
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

  return { status: 'created', email: normalizedEmail };
}
