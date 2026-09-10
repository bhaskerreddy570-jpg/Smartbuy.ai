# SmartBuy AI

AI-powered purchasing advisor for the Indian market. Customers enter natural-language requests; the platform interprets intent, searches authorized provider adapters, matches products across merchants, and recommends the best option with customer-first scoring.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- PostgreSQL 15+ + Prisma 8
- Auth.js (customer) + custom admin sessions
- Mock provider adapters (Amazon, Flipkart, Croma) for development

## Quick start

```bash
cp .env.example .env
npm install --legacy-peer-deps
npm run contract:emit
npm run db:migrate
npm run dev
```

Open http://localhost:3000 and try:
- "Find the cheapest iPhone 17 256GB"
- "Best laptop under ₹70,000 for programming"
- "Compare ride options from Hyderabad Airport"

## Key features

- **AI natural-language search** with deterministic intent parsing
- **Product matching** across merchants (GTIN, model, variant attributes)
- **Customer-first recommendations** (75% customer value / 25% business)
- **Affiliate click tracking** with secure redirect (`/go/product`)
- **Ride fare comparison** with customer-provided fares
- **Admin panel** for providers, merchants, settings
- **Price history & alerts** (schema ready, workers planned)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit tests |
| `npm run db:migrate` | Apply migrations |
| `npm run admin:bootstrap` | Create initial admin user |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Providers](docs/PROVIDERS.md)
- [Affiliate](docs/AFFILIATE.md)
- [Deployment](docs/DEPLOYMENT.md)

## Principles

1. Customer satisfaction over commission
2. No unauthorized data scraping
3. Data honesty (live, cached, historical, customer-provided labels)
4. Server-side secrets only
