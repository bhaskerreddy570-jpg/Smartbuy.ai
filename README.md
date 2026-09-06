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

1. Copy environment variables:

```bash
cp .env.example .env
```

2. Configure `.env` with PostgreSQL and AWS values. Never commit `.env`.

3. Install dependencies:

```bash
npm install --legacy-peer-deps
```

4. Emit the Prisma 8 contract:

```bash
npm run contract:emit
```

5. Apply migrations to your development database:

```bash
npx prisma db migrate --db "$DATABASE_URL"
```

6. Start the development server:

```bash
npm run dev
```

## Required environment variables

See `.env.example`. Minimum required values:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `AWS_REGION`
- `AWS_S3_BUCKET`

## AWS S3 requirements

- Private bucket with block public access enabled
- Least-privilege IAM permissions for object read/write/delete
- Preferred region: `ap-south-1`
- Object key pattern: `users/{userId}/files/{fileId}`

## Security notes

- AWS credentials remain server-side only
- Browser receives short-lived presigned URLs, not permanent credentials
- File ownership is verified on the server for every file operation
- Unauthorized access attempts return generic not-found responses

## Scripts

- `npm run dev` — development server
- `npm run build` — emit contract and production build
- `npm run contract:emit` — regenerate Prisma 8 contract artefacts
- `npm run lint` — ESLint

## Repository

Private GitHub repository: `bhaskerreddy570-jpg/Storage`
