# SmartBuy AI Authentication Architecture

## Identity boundaries

SmartBuy AI uses two independent authentication domains:

- **Customer identity:** Auth.js credentials authentication backed by `User`.
- **Admin identity:** dedicated `AdminUser` + `AdminSession` authentication. Admin credentials are never treated as customer authorization.
- Admin routes are protected separately from customer routes.
- Customer data APIs require an authenticated customer session.
- Admin APIs must require an authenticated admin session and should additionally enforce role checks for sensitive operations.

## Customer lifecycle

1. Registration validates name, optional phone, email and strong password.
2. Passwords are stored only as bcrypt hashes.
3. Registration creates notification preferences transactionally.
4. Login validates credentials and records a device/session record.
5. Auth.js provides the application session.
6. Account profile allows name and phone changes; email is immutable through the normal profile endpoint.
7. Password change verifies the existing password, hashes the new password, and revokes other tracked customer sessions.
8. Logout revokes the current tracked customer session and signs out of Auth.js.
9. Session APIs allow the account owner to inspect and revoke tracked sessions.
10. Notification preferences have a dedicated authenticated API.

## Customer account surfaces

- `/register`
- `/login`
- `/account`
- `/account/profile`
- `/api/account/profile`
- `/api/account/password`
- `/api/account/sessions`
- `/api/account/notifications`
- `/api/auth/logout`

## Admin lifecycle

1. Admin is provisioned by the controlled bootstrap process.
2. Admin login uses a dedicated HttpOnly, Secure-in-production, SameSite=Strict cookie.
3. Login is rate-limited and failed attempts can lock the admin account.
4. Existing admin MFA enforcement is honored whenever `mfaEnabled` is true.
5. Admin sessions are stored hashed and can be revoked.
6. Admin activity is written to the admin audit log.
7. Admin and customer credentials remain separate.

## Security rules

- Never store plaintext passwords, session tokens, MFA secrets, or provider credentials.
- Never put authentication secrets in client bundles, URLs, localStorage or sessionStorage.
- Do not allow customer profile APIs to modify roles or admin state.
- Do not use the customer session as proof of admin access.
- Keep admin and customer login endpoints separate.
- Use generic authentication failure messages to reduce account enumeration.
- Keep password changes and session revocation server-side.
- Email verification, password-reset email delivery, passkey/social login, and full MFA enrollment should be added through dedicated providers/flows rather than weakening the current credential model.

## Production dependencies still required

The authentication code is deployment-ready in structure, but production operation still requires:

- `AUTH_SECRET` and the production Auth.js URL configuration.
- `DATABASE_URL`.
- A real email provider before enabling email verification or password-reset emails.
- MFA enrollment/configuration before requiring MFA for the admin account.
- Security review and automated integration/e2e coverage before public launch.

## Important note

The tracked customer `UserSession` records provide device/session visibility and revocation state, while Auth.js currently owns the browser authentication cookie. A future hardening pass should make revocation authoritative for every authenticated request if the product requires immediate server-side invalidation of an already-issued Auth.js JWT.
