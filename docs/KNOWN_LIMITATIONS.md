# SmartBuy AI — Known Limitations

Last updated: 2026-09-10

This document lists intentional limitations and gaps. Do not present these as fully resolved features.

---

## Provider integrations

### Live ecommerce data
- **Amazon, Flipkart, Croma**: Mock data only in development (`USE_MOCK_PROVIDERS=true`). Real PA-API / affiliate API adapters are not implemented.
- **Reliance Digital, Vijay Sales, Tata CLiQ, Myntra, AJIO, Nykaa, Meesho**: Return `NOT_SUPPORTED` / `NOT_CONFIGURED`. No unauthorized scraping.
- **Status**: BLOCKED until authorized API credentials and affiliate program approval.

### Ride providers (Uber, Ola, Rapido)
- Live fares are **not available** through authorized connections.
- Customers must check fares in provider apps and enter them manually, or upload a screenshot.
- All ride fare data is labeled **CUSTOMER PROVIDED** and is not independently verified.

---

## Affiliate & commerce

- `/go/product` resolves products from mock listings when database merchant listings are not synced.
- Commission tracking creates CLICKED records on redirect; order confirmation depends on affiliate network postbacks.
- Estimated, confirmed, and paid commission amounts are separate fields but postback integration with real networks is not tested.
- Admin merchant/provider pages may display mock configuration alongside database records.

---

## Price history & alerts

- Price observations are recorded when search results include `canonicalProductId` and seeded merchants exist in DB.
- Without provider sync, price history will have limited data.
- Price alert worker checks prices via mock provider search — not live merchant APIs.
- Notifications are created as in-app records only; email and push delivery are not implemented.
- Worker must be triggered by external cron (e.g., Vercel Cron, GitHub Actions).

---

## Product matching

- Matching logic runs in-memory during search; results are not automatically persisted to `merchant_listings`.
- Admin matching page is read-only; manual merge/unmatch actions are not implemented.
- Different product variants (storage, color, RAM) are correctly kept separate by the matcher.

---

## AI features

- Without `AI_API_KEY`, all AI operations use deterministic/mock implementations.
- Screenshot fare extraction uses AI vision when configured; otherwise returns low-confidence stub.
- Screenshot files are not uploaded to object storage — only metadata is persisted.
- Screenshot upload UI is not wired in the ride comparison component.

---

## Authentication & roles

- Customer users do not have an explicit `role` column; all registered users are customers.
- `UserRole` enum exists in schema but is not applied to the `User` model.
- Admin authorization checks `ADMIN` role only; `SUPER_ADMIN` exists in schema for future use.

---

## Security

- Customer-facing APIs (`/api/search`, `/api/auth/register`, ride APIs) do not have rate limiting.
- CSRF protection relies on Next.js defaults; no additional hardening documented.
- Legal compliance (GDPR, DPDP Act, etc.) has not been verified — privacy/terms are placeholders.

---

## SEO & branding

- Final brand name has not been approved. Site uses `PROJECT_NAME_PLACEHOLDER` / `NEXT_PUBLIC_SITE_NAME`.
- Product structured data (schema.org/Product) is not implemented.
- Sitemap does not include authenticated pages (by design).

---

## Testing & operations

- No integration or E2E test suite in CI.
- Database-dependent features require PostgreSQL; local Docker may not be available in all environments.
- Provider sync jobs table exists but no producer/consumer worker is implemented.

---

## What requires external approval

| Item | Provider / party |
|------|------------------|
| Amazon product data & affiliate links | Amazon Associates + PA-API |
| Flipkart product data & affiliate | Flipkart Affiliate Program |
| Croma and other retailer APIs | Individual merchant partnerships |
| Uber/Ola/Rapido live fares | Authorized mobility APIs (none configured) |
| Brand name | Product owner approval |
| Legal documents | Legal counsel review |

---

## Honest status summary

SmartBuy AI is a **functional beta platform** with mock commerce data and customer-assisted ride comparison. It demonstrates the full architecture — search, recommendation, affiliate tracking, admin console, and worker patterns — but **must not be marketed as having live pricing from all listed merchants** until authorized integrations are complete.
