# CloudStoreNow Admin / Break-Glass Foundation

Password-only admin authentication for the current phase. **MFA is intentionally excluded** but extension points remain in `src/lib/admin/mfa.ts`.

## Features

- Separate `AdminUser` model with a single `ADMIN` role
- One-time initial ADMIN provisioning via env vars (idempotent)
- Authenticated password change with session revocation
- Database-backed admin sessions (`HttpOnly`, `SameSite=Strict`, `Secure` in production)
- Login rate limiting and automatic admin account lockout
- Complete admin audit logging
- Customer account lock/unlock hooks
- Recovery token hooks (issue + complete)
- Backup / data recovery request hooks (audit-logged architecture)
- Additive migrations only

## Provision the initial ADMIN (one-time)

Never commit credentials. Set env vars locally or in your deployment shell, then run the bootstrap command once per environment:

```bash
export ADMIN_INITIAL_EMAIL="you@example.com"
export ADMIN_INITIAL_PASSWORD="your-long-admin-password"
npm run admin:bootstrap
```

Legacy aliases still supported by the bootstrap script:

- `ADMIN_BOOTSTRAP_EMAIL`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_BOOTSTRAP_DISPLAY_NAME`

Behavior:

- Creates the first ADMIN only when no admin account exists
- Refuses to overwrite an existing ADMIN password
- Never prints the password
- Reports whether the ADMIN was created or already exists

Sign in at `/admin/login`, then change the password at `/admin/change-password`.

## Admin API routes

| Route | Method | Auth |
|-------|--------|------|
| `/api/admin/auth/login` | POST | Public |
| `/api/admin/auth/logout` | POST | Admin session |
| `/api/admin/auth/me` | GET | Admin session |
| `/api/admin/auth/change-password` | POST | Admin session |
| `/api/admin/audit-logs` | GET | Admin |
| `/api/admin/customers/:userId/lock` | POST | Admin |
| `/api/admin/customers/:userId/lock` | DELETE | Admin |
| `/api/admin/recovery/initiate` | POST | Admin |
| `/api/admin/recovery/complete` | POST | Public (requires valid recovery token + email + new password) |
| `/admin/recovery-handoff` | GET | Admin one-time token handoff page |
| `/admin/change-password` | GET | Admin |
| `/api/admin/operations/backup` | POST | Admin |
| `/api/admin/operations/data-recovery` | POST | Admin |

## Recovery token security

- Tokens are `randomBytes(32)` base64url values
- Only SHA-256 hashes are stored in PostgreSQL
- Tokens expire after 1 hour by default
- Single-use atomic completion clears `recoveryTokenHash`
- Initiation/completion are rate limited via audit-log counters
- Tokens are **not** returned in initiate JSON responses
- ADMIN copies the token once from `/admin/recovery-handoff`
- Audit metadata is sanitized to exclude passwords, tokens, sessions, and AWS/database secrets

## Future MFA

Enable later by implementing `src/lib/admin/mfa.ts` without changing session or audit architecture.
