# Provider Adapters

## Interface

Each provider implements `ProviderAdapter` in `src/lib/smartbuy/providers/types.ts`:

- `search(query, intent)` — required
- `getProduct(id)`, `getPrice(id)`, `getAffiliateLink(listing)`, `getProductUrl(listing)` — optional

Unsupported operations return `{ status: 'NOT_SUPPORTED' }`.

## Mock providers (development)

| Provider | Slug | Data mode |
|----------|------|-----------|
| Amazon India | `amazon` | MOCK |
| Flipkart | `flipkart` | MOCK |
| Croma | `croma` | MOCK |

Enabled by default. Real adapters replace mocks when credentials are configured.

## Adding a provider

1. Create adapter in `src/lib/smartbuy/providers/adapters/`
2. Register in `src/lib/smartbuy/providers/registry.ts`
3. Add merchant config and commission rules
4. Set `Provider.status` and `dataMode` in database
5. Add allowed domains to `affiliate-redirect.ts`

## Ride providers

Uber, Ola, Rapido do not have authorized live fare APIs. The platform shows deep links and supports customer-provided fare comparison.
