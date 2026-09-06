#!/usr/bin/env node
/**
 * One-time local bootstrap for the first admin user.
 * Reads credentials from environment variables only — never hard-coded.
 *
 * Required env vars:
 *   ADMIN_BOOTSTRAP_EMAIL
 *   ADMIN_BOOTSTRAP_PASSWORD
 * Optional:
 *   ADMIN_BOOTSTRAP_DISPLAY_NAME
 *   ADMIN_BOOTSTRAP_ROLE=SUPER_ADMIN|ADMIN
 */
import 'dotenv/config';
import { createBootstrapAdminUser } from '../src/lib/admin/login.ts';
import { hashAdminPassword } from '../src/lib/admin/password.ts';

async function main() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();

  if (!email || !password) {
    console.error(
      'Missing ADMIN_BOOTSTRAP_EMAIL or ADMIN_BOOTSTRAP_PASSWORD in environment.',
    );
    process.exit(2);
  }

  if (password.length < 12) {
    console.error('ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.');
    process.exit(2);
  }

  const passwordHash = await hashAdminPassword(password);
  const role =
    process.env.ADMIN_BOOTSTRAP_ROLE === 'ADMIN' ? 'ADMIN' : 'SUPER_ADMIN';

  const admin = await createBootstrapAdminUser({
    email,
    passwordHash,
    displayName: process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME?.trim(),
    role,
  });

  console.log(`Admin user created: ${admin.email} (${role})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Bootstrap failed');
  process.exit(1);
});
