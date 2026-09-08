#!/usr/bin/env node
/**
 * One-time provisioning for the initial ADMIN account.
 * Reads credentials from environment variables only — never hard-coded.
 *
 * Preferred env vars:
 *   ADMIN_INITIAL_EMAIL
 *   ADMIN_INITIAL_PASSWORD
 * Optional:
 *   ADMIN_INITIAL_DISPLAY_NAME
 *
 * Legacy aliases (still supported):
 *   ADMIN_BOOTSTRAP_EMAIL
 *   ADMIN_BOOTSTRAP_PASSWORD
 *   ADMIN_BOOTSTRAP_DISPLAY_NAME
 */
import 'dotenv/config';
import { provisionInitialAdmin } from '../src/lib/admin/bootstrap.ts';

async function main() {
  const result = await provisionInitialAdmin();

  switch (result.status) {
    case 'created':
      console.log(`Initial ADMIN created for ${result.email}.`);
      console.log('Sign in at /admin/login and change the password after first login.');
      return;
    case 'already_exists':
      console.log(`ADMIN already exists for ${result.email}. No changes were made.`);
      return;
    case 'missing_credentials':
      console.error(
        'Missing ADMIN_INITIAL_EMAIL or ADMIN_INITIAL_PASSWORD in environment.',
      );
      console.error(
        'Set ADMIN_INITIAL_EMAIL=bhaskerreddy570@gmail.com and a 12+ character password, then rerun.',
      );
      process.exit(2);
      return;
    case 'invalid_credentials':
      console.error(result.reason);
      process.exit(2);
      return;
    default:
      console.error('Unable to provision initial ADMIN.');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Bootstrap failed');
  process.exit(1);
});
