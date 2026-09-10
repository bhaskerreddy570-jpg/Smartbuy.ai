# SmartBuy AI — Production Readiness

Last updated: 2026-09-10

## Readiness assessment: **Beta-ready with mock providers**

The application can be deployed for development and staged beta testing. Live merchant integrations require authorized API and affiliate credentials before claiming production-complete provider status.

---

## What is production-ready

### Core platform
- Next.js 16 App Router application with TypeScript strict mode
- PostgreSQL schema with migrations and development seed script
- Customer authentication (Auth.js) and separate admin authentication
- Health check endpoints (`/api/health`, `/api/health/db`)

### Customer features
- Natural-language product search with AI + deterministic fallback
- Customer-first recommendation engine (75/25 default weights)
- Product matching across merchants with confidence thresholds
- Secure affiliate redirect (`/go/product`) with domain allowlist
- Ride fare comparison in customer-assisted mode
- Price alerts API, saved products, search history
- Privacy, terms, and affiliate disclosure pages

### Admin console
- Overview dashboard with affiliate and search metrics
- Provider, merchant, product, matching, user, alert management views
- Affiliate program and commission tracking
- AI configuration status page
- System health and audit logs

### Security foundations
- Server-side credential storage only
- Admin session cookies (HttpOnly, SameSite=Strict)
- Admin login rate limiting and account lockout
- Redirect parameter validation and domain allowlist
- Cron and postback endpoints protected by secrets

### SEO & branding
- Configurable site name (`PROJECT_NAME_PLACEHOLDER` until brand approved)
- Metadata, sitemap, robots.txt, WebSite/Organization JSON-LD

---

## Pre-production checklist

| Item | Status | Action required |
|------|--------|-----------------|
| PostgreSQL provisioned | Required | Set `DATABASE_URL`, run `npm run db:migrate`, `npm run db:seed` |
| `AUTH_SECRET` set | Required | `openssl rand -base64 32` |
| `CRON_SECRET` set | Required | For price alert worker cron |
| Admin bootstrap | Required | `npm run admin:bootstrap` |
| Brand name approved | Pending | Update `NEXT_PUBLIC_SITE_NAME` |
| Legal review of privacy/terms | Pending | Replace placeholder copy |
| Live provider credentials | Blocked | Amazon PA-API, Flipkart affiliate API, etc. |
| Email delivery for alerts | Not implemented | Integrate SendGrid/SES for EMAIL channel |
| Customer API rate limiting | Recommended | Add to `/api/search`, `/api/auth/register` |
| E2E test suite | Recommended | Add Playwright or similar |
| Monitoring/alerting | Recommended | Wire to Datadog, Sentry, or similar |

---

## Deployment steps

### 1. Environment setup

```bash
cp .env.example .env
# Edit DATABASE_URL, AUTH_SECRET, CRON_SECRET
```

### 2. Database

```bash
npm install --legacy-peer-deps
npm run contract:emit
npm run db:migrate
npm run db:seed
npm run admin:bootstrap
```

### 3. Build and start

```bash
npm run build
npm start
```

### Docker

```bash
docker compose up -d
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel/Neon deployment.

### 4. Cron configuration

Schedule a POST to `/api/cron/price-alerts` with header:
```
Authorization: Bearer <CRON_SECRET>
```

Recommended: every 6–12 hours (not continuously — respect provider rate limits).

### 5. Health verification

```bash
curl https://your-domain/api/health
curl https://your-domain/api/health/db
```

---

## Test results (latest run)

| Command | Result |
|---------|--------|
| `npm test` | 55 tests, all passing |
| `npm run lint` | Pass |
| `npm run build` | Pass |

---

## Security findings

| Finding | Severity | Mitigation |
|---------|----------|------------|
| Customer APIs lack rate limiting | Medium | Add rate limit middleware before public launch |
| Privacy/terms are placeholders | Low | Legal review before marketing |
| Mock provider data in development | Info | Set `USE_MOCK_PROVIDERS=false` only with real credentials |
| Postback endpoint optional secret | Medium | Always set `AFFILIATE_POSTBACK_SECRET` in production |
| Screenshot storage is metadata-only | Low | Wire S3 upload before screenshot feature goes live |

Provider/API secrets are not exposed to frontend code. Affiliate tags are injected server-side only.

---

## Recommended next steps

1. **Approve brand name** — replace `PROJECT_NAME_PLACEHOLDER`
2. **Obtain affiliate/API credentials** — Amazon Associates, Flipkart affiliate program
3. **Implement real provider adapters** — one merchant at a time with authorized APIs
4. **Add email notifications** — for price alerts (EMAIL channel)
5. **Wire merchant listings sync** — populate DB from provider feeds
6. **Add customer API rate limiting** — protect search and auth endpoints
7. **Legal review** — privacy policy and terms of service
8. **E2E testing** — full customer and admin flows with real database
