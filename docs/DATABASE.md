# SmartBuy AI — Database Schema

PostgreSQL with Prisma 8 contract ORM. Schema source: `src/prisma/schema.prisma`.

## Core Tables

| Table | Purpose |
|-------|---------|
| `User` | Customer accounts |
| `UserSession` | Customer session tracking |
| `Provider` | Provider registry (Amazon, Flipkart, Uber, etc.) |
| `ProviderCredential` | Encrypted server-side credentials |
| `Merchant` | Merchant/affiliate configuration |
| `AffiliateProgram` | Affiliate network programs |
| `CommissionRule` | Data-driven commission rates by category/product |
| `Product` | Canonical products |
| `ProductVariant` | Product variants (storage, color, etc.) |
| `ProductIdentifier` | GTIN, EAN, model numbers |
| `MerchantListing` | Per-merchant product listings |
| `PriceObservation` | Historical price data |
| `Search` | Customer search requests |
| `SearchResult` | Ranked search results |
| `Recommendation` | Top recommendations with explanations |
| `AffiliateClick` | Click tracking |
| `AffiliateOrder` | Order data from affiliate networks |
| `AffiliateCommission` | Commission lifecycle (CLICKED → PAID) |
| `PriceAlert` | Customer price alerts |
| `CustomerSubmittedFare` | Manual ride fare entries |
| `CustomerScreenshot` | Screenshot uploads for fare extraction |
| `SystemSetting` | Configurable weights, thresholds, disclosure text |
| `AdminUser` / `AdminSession` / `AdminAuditLog` | Admin panel |

## Migrations

```bash
npm run contract:emit    # Regenerate contract from schema
npm run db:migrate       # Apply migrations
npm run db:status        # Check migration status
```

## Indexes

Key indexes on: `User.email`, `Provider.slug`, `Merchant.slug`, `Product.category`, `MerchantListing.canonicalProductId`, `PriceObservation.productId+observedAt`, `Search.userId`, `AffiliateClick.merchantId`, `PriceAlert.status`.
