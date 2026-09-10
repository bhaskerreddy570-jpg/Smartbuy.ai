# SmartBuy AI — Deployment

Production site: **https://smartbuy.ai**

Repository: https://github.com/bhaskerreddy570-jpg/Smartbuy.ai

## Environment variables

See `.env.example`. Required:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://smartbuy.ai` |
| `USE_MOCK_PROVIDERS` | `true` (until real API credentials are available) |

## Vercel deployment

1. Import the **Smartbuy.ai** GitHub repository in [Vercel Dashboard](https://vercel.com/dashboard)
2. Set production branch to `main`
3. Build uses `vercel.json` → `scripts/vercel-build.sh`
4. Add environment variables (never commit secrets)
5. Connect custom domain `smartbuy.ai` in Vercel → Domains

### Database (Neon recommended)

- `DATABASE_URL` — pooled connection for runtime
- `DATABASE_URL_UNPOOLED` — direct connection for migrations at build time

Migrations run automatically during Vercel build when a database URL is available.

## Health check

```
GET https://smartbuy.ai/api/health
```

## Admin bootstrap

After first deploy, set admin credentials and run:

```bash
npm run admin:bootstrap
```

Or rely on runtime bootstrap via `instrumentation.ts` if `ADMIN_INITIAL_EMAIL` and `ADMIN_INITIAL_PASSWORD` are set in Vercel env.

## Local development

```bash
cp .env.example .env
npm install --legacy-peer-deps
npm run contract:emit
npm run db:migrate
npm run dev
```

## Docker

```bash
docker compose up -d
```
