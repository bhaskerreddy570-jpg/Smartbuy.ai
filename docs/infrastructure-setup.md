# Infrastructure Setup Guide

Use this guide **after** you have recovered access to your existing AWS account and have a PostgreSQL database available for development.

**Do not commit `.env` or any credentials to Git.**

PR #2 should remain unmerged until PostgreSQL and S3 are configured and end-to-end tests pass on your machine.

---

## Current blocker: AWS root MFA recovery

The next dependency is recovering access to your existing AWS root account (MFA device unavailable).

Until access is restored:

- Do **not** create a new AWS account for this project
- Do **not** create production AWS resources yet
- Do **not** replace AWS S3 with another storage provider (including GoDaddy storage)
- Keep PR #2 unmerged

When access is restored, continue with the steps below using your **existing** AWS account.

Official AWS guidance for account access recovery:

- [Recovering your root user MFA device](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_lost-or-broken.html)
- [AWS account recovery](https://docs.aws.amazon.com/signin/latest/userguide/troubleshooting-sign-in-issues.html)

Use an IAM user (not root) for day-to-day development credentials once you can sign in again.

---

## Step 1 — Local environment file

On your machine only:

```bash
cp .env.example .env
```

Fill in values locally. Never paste secrets into Cursor chat or commit `.env`.

Generate an auth secret:

```bash
openssl rand -base64 32
```

Validate configuration:

```bash
npm run check:env
```

---

## Step 2 — PostgreSQL (development)

### Requirements

- PostgreSQL **15+**
- A dedicated database (example name: `storage`)
- Connection string format:

```
postgresql://USER:PASSWORD@HOST:5432/storage?schema=public
```

### Options

| Option | Notes |
|--------|-------|
| Local PostgreSQL | Install via package manager or Docker; suitable for development |
| Managed PostgreSQL | RDS, Supabase, Neon, etc.; use SSL params if required by provider |

### Safe migration commands

**Allowed:**

```bash
npm run contract:emit
npm run db:migrate      # applies additive migration only
npm run db:status       # reports migration status
```

**Not allowed for this project phase:**

- `prisma migrate reset`
- `DROP DATABASE`
- Any command that deletes existing production data

The initial migration (`migrations/app/20260906T0903_init/`) only creates tables, indexes, and foreign keys.

---

## Step 3 — AWS S3 (private bucket, ap-south-1)

Create these resources manually in your **existing** AWS account when access is available.

### 3.1 S3 bucket checklist

| Setting | Required value |
|---------|----------------|
| Region | `ap-south-1` (Mumbai) |
| Block Public Access | **All four settings enabled** |
| Object Ownership | Bucket owner enforced (recommended) |
| ACLs | Disabled (recommended) |
| Static website hosting | **Disabled** |
| Public bucket policy | **None** |
| Default encryption | SSE-S3 or SSE-KMS (recommended) |

Bucket name example: choose a globally unique name and set it in `.env` as `AWS_S3_BUCKET`.

### 3.2 Object key layout

The application stores objects at:

```
users/{userId}/files/{fileId}
```

Original filenames are **not** used as S3 keys.

### 3.3 IAM policy (least privilege)

Attach the policy template at [`docs/aws/iam-s3-least-privilege.json`](./aws/iam-s3-least-privilege.json) to a dedicated IAM user or role.

Replace `YOUR-PRIVATE-BUCKET-NAME` with your bucket name before creating the policy.

Permissions required on `arn:aws:s3:::YOUR-BUCKET/users/*`:

- `s3:PutObject`
- `s3:GetObject` (also covers S3 HeadObject calls used at upload completion)
- `s3:DeleteObject`

A separate `s3:HeadObject` IAM action is **not** required for this application.

Do **not** grant `s3:*`, public ACL permissions, or `Principal: "*"` bucket policies.

### 3.4 `.env` AWS values

```
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-private-bucket-name
AWS_ACCESS_KEY_ID=...        # IAM user access key (local dev)
AWS_SECRET_ACCESS_KEY=...    # IAM user secret (local dev)
```

In production deployments, prefer IAM roles over long-lived access keys.

---

## Step 4 — Start the application

```bash
npm install --legacy-peer-deps
npm run contract:emit
npm run db:migrate
npm run db:status
npm run dev
```

Smoke checks (requires running dev server):

```bash
npm run test:e2e-smoke
```

Automated security tests (no AWS/PostgreSQL required):

```bash
npm test
```

---

## Step 5 — End-to-end validation

When infrastructure is ready, follow [`docs/e2e-validation-checklist.md`](./e2e-validation-checklist.md).

Report results (without secrets) before merging PR #2.

---

## What this application does **not** use

- GoDaddy storage or any non-S3 backend for customer files
- Public S3 URLs or browser-exposed AWS credentials
- MIME-type allowlists that block normal file uploads
- Server-side execution of uploaded files

Customer files are stored in **private AWS S3** via short-lived presigned URLs.
