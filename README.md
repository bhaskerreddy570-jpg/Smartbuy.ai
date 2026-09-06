# Cloud Storage Platform

Secure customer cloud-storage SaaS built with Next.js, PostgreSQL, Prisma 8, Auth.js, and AWS S3.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL 15+ + Prisma 8 (`@prisma/orm-postgres`)
- Auth.js credentials authentication
- AWS S3 private bucket storage (ap-south-1 preferred)

## Phase 1 foundation

- User registration, login, logout
- Authenticated dashboard with storage usage
- Private S3 upload via presigned URLs
- Secure download via short-lived presigned URLs
- Secure delete with storage usage updates
- Server-side ownership checks and quota enforcement

## Local setup

1. Copy environment variables locally (never commit `.env`):

```bash
cp .env.example .env
```

Fill in PostgreSQL and AWS values on your machine only. See **[docs/infrastructure-setup.md](docs/infrastructure-setup.md)** for the full AWS/PostgreSQL setup guide (including what to do while AWS MFA access is being recovered).

2. Validate required env vars:

```bash
npm run check:env
```

3. Install dependencies:

```bash
npm install --legacy-peer-deps
```

4. Emit the Prisma 8 contract:

```bash
npm run contract:emit
```

5. Apply migrations to your development database (safe, non-destructive):

```bash
npm run db:migrate
```

6. Check migration status:

```bash
npm run db:status
```

7. Start the development server:

```bash
npm run dev
```

8. After PostgreSQL, S3, and the dev server are configured, run smoke checks:

```bash
npm run test:e2e-smoke
```

## Required environment variables

See `.env.example`. Minimum required values:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`

## AWS S3 requirements

See **[docs/infrastructure-setup.md](docs/infrastructure-setup.md)** for bucket, IAM, and MFA recovery guidance.

Summary:

- Private bucket with block public access enabled
- Least-privilege IAM: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `users/*` (`GetObject` covers HeadObject)
- Preferred region: `ap-south-1`
- Object key pattern: `users/{userId}/files/{fileId}`
- IAM policy template: [`docs/aws/iam-s3-least-privilege.json`](docs/aws/iam-s3-least-privilege.json)
- E2E checklist (run before merge): [`docs/e2e-validation-checklist.md`](docs/e2e-validation-checklist.md)
- Admin / break-glass foundation: [`docs/admin-break-glass.md`](docs/admin-break-glass.md)

## Security notes

- AWS credentials remain server-side only
- Browser receives short-lived presigned URLs, not permanent credentials
- File ownership is verified on the server for every file operation
- Unauthorized access attempts return generic not-found responses
- General-purpose storage: normal file types are allowed; executable/script extensions are blocked server-side
- S3 objects are stored with neutral `application/octet-stream`; original MIME metadata is kept in the database only
- Downloads use `Content-Disposition: attachment` to reduce in-browser execution risk
- Optional `BLOCKED_FILE_EXTENSIONS` can extend the default blocked-extension list
- Quota is reserved atomically at upload request using `SELECT ... FOR UPDATE`
- Upload completion is idempotent for concurrent completion requests
- Optional antivirus hook is disabled by default (`ANTIVIRUS_SCAN_ENABLED`)

## Scripts

- `npm run dev` — development server
- `npm run build` — emit contract and production build
- `npm run contract:emit` — regenerate Prisma 8 contract artefacts
- `npm run lint` — ESLint
- `npm test` — automated security and policy tests
- `npm run check:env` — validate local `.env` (no secrets printed)
- `npm run db:migrate` — apply migrations safely (non-destructive)
- `npm run db:status` — report migration status
- `npm run test:e2e-smoke` — smoke checks after DB/S3/dev server are configured

## Repository

Private GitHub repository: `bhaskerreddy570-jpg/Storage`
