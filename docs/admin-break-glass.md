# CloudStoreNow Admin / Break-Glass Foundation

Password-only admin authentication for the current phase. **MFA is intentionally excluded** but extension points remain in `src/lib/admin/mfa.ts`.

## Features

- Separate `AdminUser` model with `ADMIN` / `SUPER_ADMIN` roles
- Database-backed admin sessions (`HttpOnly`, `SameSite=Strict`, `Secure` in production)
- Login rate limiting and automatic admin account lockout
- Complete admin audit logging
- Customer account lock/unlock hooks
- Recovery token hooks (issue + complete)
- Backup / data recovery request hooks (audit-logged architecture)
- Additive migration only: `20260906T1321_admin_foundation`

## Bootstrap first admin (local only)

Never commit credentials. Set env vars locally, then:

```bash
export ADMIN_BOOTSTRAP_EMAIL="you@example.com"
export ADMIN_BOOTSTRAP_PASSWORD="your-long-admin-password"
export ADMIN_BOOTSTRAP_ROLE="SUPER_ADMIN"
node scripts/bootstrap-admin.mjs
```

Sign in at `/admin/login`.

## Admin API routes

| Route | Method | Auth |
|-------|--------|------|
| `/api/admin/auth/login` | POST | Public |
| `/api/admin/auth/logout` | POST | Admin session |
| `/api/admin/auth/me` | GET | Admin session |
| `/api/admin/audit-logs` | GET | Admin |
| `/api/admin/customers/:userId/lock` | POST | Admin |
| `/api/admin/customers/:userId/lock` | DELETE | Admin |
| `/api/admin/recovery/initiate` | POST | SUPER_ADMIN |
| `/api/admin/recovery/complete` | POST | Public (token) |
| `/api/admin/operations/backup` | POST | Admin |
| `/api/admin/operations/data-recovery` | POST | Admin |

## Future MFA

Enable later by implementing `src/lib/admin/mfa.ts` without changing session or audit architecture.
