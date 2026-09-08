#!/usr/bin/env node
import 'dotenv/config';
import {
  ensureApplicationAdminProvisioned,
  resolveDesignatedAdminEmail,
  resolvePortalUserRole,
} from '../src/lib/admin/bootstrap.ts';
import { orm } from '../src/lib/db.ts';

const target = (process.env.ADMIN_CHECK_EMAIL ?? resolveDesignatedAdminEmail()).toLowerCase();
const bootstrapResult = await ensureApplicationAdminProvisioned();

const admins = await orm.AdminUser.select('id', 'email', 'role', 'lockedAt', 'createdAt').all();
const customer = await orm.User.where({ email: target })
  .select('id', 'email', 'name', 'lockedAt')
  .first();
const portalRole = await resolvePortalUserRole(target);

console.log(
  JSON.stringify(
    {
      targetEmail: target,
      bootstrapStatus: bootstrapResult.status,
      adminCount: admins.length,
      admins: admins.map((admin) => ({
        email: admin.email,
        role: admin.role,
        locked: Boolean(admin.lockedAt),
      })),
      customerFound: Boolean(customer),
      customerLocked: customer ? Boolean(customer.lockedAt) : null,
      targetHasAdminRecord: admins.some((admin) => admin.email === target),
      portalRole,
    },
    null,
    2,
  ),
);
