# SmartBuy AI — Architecture

## Overview

SmartBuy AI is an AI-powered purchasing advisor for the Indian market. Customers enter natural-language requests; the platform interprets intent, searches authorized provider adapters, matches products across merchants, scores recommendations (customer-first), and routes purchases through legitimate affiliate links.

## Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- **Backend:** Next.js API routes, server-side business logic
- **Database:** PostgreSQL 15+ with Prisma 8 contract ORM
- **Auth:** Auth.js (customer JWT) + custom admin cookie sessions
- **AI:** Optional OpenAI-compatible API for NLU; deterministic fallbacks when unavailable

## Core Principles

1. **Customer satisfaction over commission** — customer value score dominates (70–80% default)
2. **No unauthorized data access** — provider adapters declare supported operations; unsupported returns `NOT_SUPPORTED`
3. **Data honesty** — every price shows freshness (live, cached, historical, customer-provided, estimated)
4. **Server-side secrets** — affiliate credentials never reach the browser

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  Customer UI (/, /search, /product, /account)           │
├─────────────────────────────────────────────────────────┤
│  API Routes (/api/search, /api/go/product, /api/...)    │
├─────────────────────────────────────────────────────────┤
│  Business Logic                                         │
│  • Intent Parser    • Product Matcher                     │
│  • Comparison       • Recommendation Engine               │
│  • Savings          • Commission Calculator               │
│  • Price History    • Price Alerts                        │
├─────────────────────────────────────────────────────────┤
│  Provider Registry + Adapters (Mock / Real)               │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL (Prisma 8)                                  │
└─────────────────────────────────────────────────────────┘
```

## Provider Adapter Interface

Each provider implements a standard interface:

- `search(query, intent)` — search products/offers
- `getProduct(id)` — single product detail
- `getOffers(id)` — merchant offers
- `getAvailability(id)` — stock status
- `getPrice(id)` — current price
- `getAffiliateLink(listing)` — authorized tracking URL
- `getProductUrl(listing)` — direct product URL

Unsupported methods return `{ status: 'NOT_SUPPORTED' }`.

## Recommendation Engine

Two independent scores combined with configurable weights:

| Score | Factors |
|-------|---------|
| **Customer Value** | Price, suitability, specs, seller quality, warranty, delivery, ratings, price history |
| **Business/Affiliate** | Affiliate availability, commission rate, conversion probability, merchant reliability |

`combinedScore = customerWeight × customerScore + businessWeight × businessScore`

Default: 75% customer / 25% business (configurable via `SystemSetting`).

## Affiliate Click Flow

```
Customer clicks "Buy on Flipkart"
  → GET /go/product/{productId}?merchant={merchantId}
  → Validate merchant domain against allowlist
  → Record AffiliateClick (CLICKED state)
  → Generate authorized affiliate URL server-side
  → 302 redirect to merchant
```

## Product Matching

Match confidence based on:

- Brand, model number, MPN, GTIN/EAN/UPC
- Variant attributes (storage, RAM, color, capacity)
- Title similarity (secondary)

Threshold default: 0.85. Below threshold → no auto-merge; admin can resolve manually.

## Data Freshness Labels

| Label | Meaning |
|-------|---------|
| LIVE | Retrieved within last 15 minutes via authorized adapter |
| CACHED | Cached response within allowed TTL |
| HISTORICAL | From price observation history |
| CUSTOMER_PROVIDED | User-entered fare or screenshot extraction |
| ESTIMATED | Calculated estimate, not verified |
| UNAVAILABLE | Provider could not return data |

## Background Jobs (planned)

- Provider sync
- Price observation collection
- Price alert checking
- Commission state updates
- Analytics aggregation

## Adding a Provider

1. Register in `Provider` table (admin or seed)
2. Implement adapter in `src/lib/providers/adapters/`
3. Register in `src/lib/providers/registry.ts`
4. Configure affiliate rules in `CommissionRule`
5. Set `dataMode` and `status` appropriately

See [PROVIDERS.md](./PROVIDERS.md) for details.
