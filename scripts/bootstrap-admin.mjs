#!/usr/bin/env node
/**
 * Idempotent provisioning for the single application ADMIN account.
 * Uses ADMIN_INITIAL_* env vars when present, otherwise links the designated
 * customer account when it already exists in the database.
 */
import 'dotenv/config';
import {
  ensureApplicationAdminProvisioned,
  resolveDesignatedAdminEmail,
  resolvePortalUserRole,
} from '../src/lib/admin/bootstrap.ts';

async function main() {
  const designatedEmail = resolveDesignatedAdminEmail();
  const result = await ensureApplicationAdminProvisioned();
  const portalRole = await resolvePortalUserRole(designatedEmail);

  switch (result.status) {
    case 'created':
      console.log(`Initial ADMIN created for ${result.email}.`);
      if (result.removedOtherAdmins > 0) {
        console.log(
          `Removed ${result.removedOtherAdmins} other admin account(s) to enforce single-admin policy.`,
        );
      }
      console.log('Sign in at /admin/login and change the password after first login.');
      break;
    case 'linked_from_customer':
      console.log(
        `Linked existing customer account ${result.email} to AdminUser (same portal password).`,
      );
      if (result.removedOtherAdmins > 0) {
        console.log(
          `Removed ${result.removedOtherAdmins} other admin account(s) to enforce single-admin policy.`,
        );
      }
      break;
    case 'already_exists':
      console.log(`ADMIN already exists for ${result.email}. No password changes were made.`);
      if (result.removedOtherAdmins > 0) {
        console.log(
          `Removed ${result.removedOtherAdmins} other admin account(s) to enforce single-admin policy.`,
        );
      }
      break;
    case 'missing_credentials':
      console.error(
        'Unable to provision ADMIN: set ADMIN_INITIAL_PASSWORD or register the designated customer account first.',
      );
      process.exit(2);
      return;
    case 'invalid_credentials':
      console.error(result.reason);
      process.exit(2);
      return;
    case 'customer_missing':
      console.error(
        `Designated admin email ${result.email} has no customer account and no ADMIN_INITIAL_PASSWORD was provided.`,
      );
      process.exit(2);
      return;
    default:
      console.error('Unable to provision initial ADMIN.');
      process.exit(1);
  }

  console.log(
    JSON.stringify({
      designatedAdminEmail: designatedEmail,
      portalRole,
      bootstrapStatus: result.status,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Bootstrap failed');
  process.exit(1);
});
