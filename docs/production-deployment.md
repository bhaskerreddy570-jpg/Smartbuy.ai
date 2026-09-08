# CloudStoreNow Production Deployment (Vercel + Neon + S3)

Use this runbook to deploy the merged `main` branch. **Never commit `.env` or secrets.**

## Architecture

| Component | Production choice |
|-----------|-------------------|
| App | Vercel (Next.js 16) |
| Database | Neon PostgreSQL via Vercel Storage |
| File storage | Existing private S3 bucket (`ap-south-1`) |
| Auth | Auth.js credentials + JWT sessions |
| Domain (phase 2) | `cloudstorenow.com` — **only after `*.vercel.app` passes E2E** |

## Step 1 — Neon PostgreSQL via Vercel (manual)

In [Vercel Dashboard](https://vercel.com/dashboard):

1. Open **Storage** → **Create Database** → **Neon**.
2. Link to team/account; region: choose closest to users (e.g. `ap-south-1` if available, otherwise Singapore/US-East).
3. Database name suggestion: `cloudstorenow-production`.
4. Vercel will inject **`DATABASE_URL`** (pooled) and often **`DATABASE_URL_UNPOOLED`** (direct).

**Created:** one Neon project + one PostgreSQL database + Vercel storage integration.  
**Not created:** no new AWS resources.

## Step 2 — Vercel project (manual)

1. **Add New Project** → import GitHub repo `bhaskerreddy570-jpg/Storage`.
2. Production branch: **`main`** (merge `vercel.json` from deployment branch first if not yet on `main`).
3. Framework: Next.js (auto-detected).
4. Root directory: `/`.

**Created:** one Vercel project linked to GitHub.

## Step 3 — Production environment variables (manual, Vercel UI)

Set in **Project → Settings → Environment Variables → Production**:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | From Vercel Neon integration (use **pooled** URL for runtime) |
| `POSTGRES_URL` | Accepted fallback if Neon injects this name instead of `DATABASE_URL` |
| `AUTH_SECRET` | New: `openssl rand -base64 32` (do not reuse dev). `NEXTAUTH_SECRET` is also accepted. |
| `AUTH_URL` | Optional on Vercel when `trustHost` is enabled; otherwise `https://YOUR-PROJECT.vercel.app` |
| `AWS_REGION` | `ap-south-1` |
| `AWS_S3_BUCKET` | `cloudstorenow-storage-777929922747-ap-south-1-an` |
| `AWS_ACCESS_KEY_ID` | Existing `CloudStoreNowApp` key (server-side only) |
| `AWS_SECRET_ACCESS_KEY` | Matching secret (server-side only) |
| `DEFAULT_STORAGE_QUOTA_BYTES` | `10737418240` |
| `MAX_UPLOAD_BYTES` | `104857600` |
| `ADMIN_INITIAL_EMAIL` | `bhaskerreddy570@gmail.com` (Production only — single application admin) |
| `ADMIN_INITIAL_PASSWORD` | Strong 12+ character password with letters and numbers (Production only; never commit) |

Optional: `ADMIN_INITIAL_DISPLAY_NAME="CloudStoreNow Admin"`, `ANTIVIRUS_SCAN_ENABLED=false` (default off).

**Never** add `NEXT_PUBLIC_*` AWS variables.

## Step 4 — Apply migrations (safe, non-destructive)

Migrations are **additive only** and must be applied before customer registration works.

### Option A — Automatic on Vercel deploy (recommended)

`vercel.json` runs `scripts/vercel-build.sh`, which applies pending migrations when a database URL is available at build time, then builds the app.

Requirements in Vercel → **Environment Variables** → **Production**:

| Variable | Scope | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | Production (runtime) | Pooled Neon URL for serverless functions |
| `DATABASE_URL_UNPOOLED` | Production (build + runtime) | Direct Neon URL for migrations during deploy |

If `DATABASE_URL_UNPOOLED` is unset, the build script falls back to `DATABASE_URL`, `POSTGRES_URL`, or other supported Neon/Vercel names. If no database URL is available at build time, migrations are skipped and runtime health is checked via `/api/health/db`.

`AUTH_SECRET` is validated at runtime only (Auth.js and `/api/health/db`). It is not required during the Vercel build step, which allows secrets scoped to Runtime in the Vercel dashboard.

### Option B — Manual from a trusted machine

From a trusted machine with the **direct/unpooled** production `DATABASE_URL` in local `.env` only:

```bash
npm run db:migrate    # runs: npx prisma db migrate --db $DATABASE_URL_UNPOOLED (or DATABASE_URL)
npm run db:status     # must report up to date
```

**Allowed migrations (all additive):**

1. `20260906T0903_init` — core customer tables (`user`, `subscription`, `file`, `folder`)
2. `20260906T1321_admin_foundation` — admin tables + `user.lockedAt` / `user.lockReason`
3. `20260906T1418_admin_single_role_provisioning` — single `ADMIN` role constraint

**Forbidden:** `prisma migrate reset`, `DROP DATABASE`, or any destructive command.

Use **`DATABASE_URL_UNPOOLED`** (or Neon direct connection) for migrations if the pooled URL fails.

### Verify runtime database readiness

After deploy, call:

```bash
curl -sS https://YOUR-PROJECT.vercel.app/api/health/db
```

Expected when healthy:

```json
{
  "ok": true,
  "databaseUrlConfigured": true,
  "connected": true,
  "userTableExists": true,
  "userSchemaReady": true
}
```

If `userTableExists` or `userSchemaReady` is `false`, pending migrations were not applied.

## Step 5 — AWS S3 + IAM

Keep existing bucket and IAM policy unchanged:

```
arn:aws:s3:::cloudstorenow-storage-777929922747-ap-south-1-an/users/*/files/*
Actions: s3:PutObject, s3:GetObject, s3:DeleteObject
```

## Step 6 — S3 CORS (required for browser uploads)

The dashboard uploads via browser `fetch()` to presigned S3 URLs. Without CORS, PUT succeeds in Node tests but **fails in the browser**.

After you know the Vercel deployment URL, add bucket CORS in AWS Console → S3 → Permissions → CORS:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "https://YOUR-PROJECT.vercel.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Add `https://cloudstorenow.com` and `https://www.cloudstorenow.com` in Step 9 only after domain goes live.

## Step 7 — Deploy to `*.vercel.app`

1. Trigger **Production Deploy** from Vercel (or push to `main`).
2. Confirm build uses `installCommand: npm install --legacy-peer-deps` (`vercel.json`).
3. Wait for deployment URL, e.g. `https://storage-xyz.vercel.app`.

## Step 8 — Production smoke / E2E

Update `AUTH_URL` in Vercel to match the live deployment URL, redeploy if changed.

From a machine with production env vars loaded locally (never commit):

```bash
AUTH_URL=https://YOUR-PROJECT.vercel.app npm run test:e2e-smoke
```

Manual browser checklist:

- Register, login, upload normal file, download, delete
- User B cannot access User A file (404)
- `.exe` upload rejected (415)
- Oversize / over-quota rejected (413/403)
- Network tab: no AWS secret keys; only presigned S3 URLs

## Step 9 — Custom domain (after Step 8 passes)

1. Vercel → **Domains** → add `cloudstorenow.com` (+ `www` if desired).
2. Configure DNS at registrar per Vercel instructions.
3. Set `AUTH_URL=https://cloudstorenow.com` (canonical URL).
4. Extend S3 CORS `AllowedOrigins` with production domain(s).
5. Redeploy and re-run smoke tests.

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Build fails on peer deps | Ensure `vercel.json` `installCommand` is present |
| Upload PUT fails in browser only | Add S3 CORS for exact Vercel origin |
| Upload PUT 403 | IAM resource path must be `users/*/files/*` |
| 401 on all APIs | `AUTH_SECRET` mismatch or `AUTH_URL` wrong |
| DB connection errors on Vercel | Use pooled `DATABASE_URL`; run migrations on direct URL |
| Registration returns "Unable to create account" | Check `/api/health/db`; apply pending migrations (`userSchemaReady: false` means admin migrations missing) |
