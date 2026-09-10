import { randomUUID } from 'node:crypto';
import { orm } from '@/lib/db';
import { hashAdminPassword } from '@/lib/admin/password';
import { revokeAllAdminSessions } from '@/lib/admin/session';

export const DESIGNATED_APPLICATION_ADMIN_EMAIL = 'bhaskerreddy570@gmail.com';

export type ProvisionInitialAdminResult =
  | { status: 'created'; email: string; removedOtherAdmins: number }
  | { status: 'already_exists'; email: string; removedOtherAdmins: number }
  | { status: 'missing_credentials' }
  | { status: 'invalid_credentials'; reason: string };

export type EnsureApplicationAdminResult =
  | ProvisionInitialAdminResult
  | {
      status: 'linked_from_customer';
      email: string;
      removedOtherAdmins: number;
    }
  | { status: 'customer_missing'; email: string };

export function resolveDesignatedAdminEmail(): string {
  return (
    process.env.ADMIN_INITIAL_EMAIL?.trim() ||
    process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() ||
    DESIGNATED_APPLICATION_ADMIN_EMAIL
  ).toLowerCase();
}

export function readInitialAdminCredentials(): {
  email: string;
  password: string | null;
  displayName: string | null;
} {
  const email = resolveDesignatedAdminEmail();
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
): Promise<{ id: string; email: string; role: 'ADMIN' | 'SUPER_ADMIN'; lockedAt: string | null } | null> {
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

async function linkDesignatedAdminFromCustomerAccount(
  normalizedEmail: string,
): Promise<EnsureApplicationAdminResult> {
  if (normalizedEmail !== resolveDesignatedAdminEmail()) {
    return { status: 'customer_missing', email: normalizedEmail };
  }

  const customerAccount = await orm.User.where({ email: normalizedEmail })
    .select('id', 'name', 'passwordHash')
    .first();

  if (!customerAccount) {
    return { status: 'customer_missing', email: normalizedEmail };
  }

  await orm.AdminUser.create({
    id: randomUUID(),
    email: normalizedEmail,
    passwordHash: customerAccount.passwordHash,
    displayName: customerAccount.name,
    role: 'ADMIN',
    mfaEnabled: false,
  });

  const removedOtherAdmins = await consolidateSingleApplicationAdmin(normalizedEmail);

  return {
    status: 'linked_from_customer',
    email: normalizedEmail,
    removedOtherAdmins,
  };
}

let ensureApplicationAdminPromise: Promise<EnsureApplicationAdminResult> | null = null;

export async function ensureApplicationAdminProvisioned(): Promise<EnsureApplicationAdminResult> {
  if (!ensureApplicationAdminPromise) {
    ensureApplicationAdminPromise = runEnsureApplicationAdminProvisioned().finally(() => {
      ensureApplicationAdminPromise = null;
    });
  }

  return ensureApplicationAdminPromise;
}

async function runEnsureApplicationAdminProvisioned(): Promise<EnsureApplicationAdminResult> {
  const normalizedEmail = resolveDesignatedAdminEmail();
  const existingAdmin = await getAdminUserByEmail(normalizedEmail);

  if (existingAdmin) {
    const removedOtherAdmins = await consolidateSingleApplicationAdmin(normalizedEmail);
    return {
      status: 'already_exists',
      email: normalizedEmail,
      removedOtherAdmins,
    };
  }

  const envProvisioned = await provisionInitialAdmin();
  if (
    envProvisioned.status === 'created' ||
    envProvisioned.status === 'already_exists'
  ) {
    return envProvisioned;
  }

  return linkDesignatedAdminFromCustomerAccount(normalizedEmail);
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
