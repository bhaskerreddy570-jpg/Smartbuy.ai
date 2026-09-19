# SmartBuy AI provider integration matrix

## Production rule

SmartBuy must only use provider data obtained through an authorized API, affiliate API, official feed, licensed feed, or explicitly permitted partner integration. It must never scrape protected endpoints, bypass CAPTCHAs, reuse customer credentials, or fabricate live prices.

## Ecommerce

| Provider | Adapter | Live activation |
|---|---|---|
| Amazon India | Amazon Creators API | AMAZON_CREATORS_CLIENT_ID + AMAZON_CREATORS_CLIENT_SECRET + AMAZON_CREATORS_PARTNER_TAG |
| Flipkart | Authorized feed/API adapter | FLIPKART_API_SEARCH_URL + FLIPKART_API_TOKEN |
| Croma | Authorized feed/API adapter | CROMA_API_SEARCH_URL + CROMA_API_TOKEN |
| Reliance Digital | Authorized feed/API adapter | RELIANCE_DIGITAL_API_SEARCH_URL + token |
| Vijay Sales | Authorized feed/API adapter | VIJAY_SALES_API_SEARCH_URL + token |
| Tata CLiQ | Authorized feed/API adapter | TATACLIQ_API_SEARCH_URL + token |
| Myntra | Authorized feed/API adapter | MYNTRA_API_SEARCH_URL + token |
| AJIO | Authorized feed/API adapter | AJIO_API_SEARCH_URL + token |
| Nykaa | Authorized feed/API adapter | NYKAA_API_SEARCH_URL + token |
| Meesho | Authorized feed/API adapter | MEESHO_API_SEARCH_URL + token |

For providers without a permitted live catalog/search API, SmartBuy remains NOT_SUPPORTED/NOT_CONFIGURED instead of inventing results.

## Amazon

The Amazon adapter uses Creators API OAuth 2.0, the https://creatorsapi.amazon/catalog/v1/* endpoints, marketplace www.amazon.in, and OffersV2. API-generated product URLs are returned unchanged.

Amazon credentials are server-side only. Never place them in NEXT_PUBLIC_*, source code, Git history, or client bundles.

## Generic authorized provider adapter

The reusable adapter expects the provider's approved endpoint to return one of:

- { "listings": [...] }
- { "products": [...] }
- { "results": [...] }
- { "data": { "listings": [...] } }

Each listing must contain a stable product ID, title and product/affiliate URL. Price, MRP, seller, availability, image, rating and identifiers are optional.

This adapter is deliberately not presented as an official provider API contract. The endpoint must be supplied by the provider/affiliate network or another authorized integration.

## Production environment

Set USE_MOCK_PROVIDERS=false.

Production must never depend on mock catalog data. Missing provider credentials cause the provider to remain unavailable while other configured providers continue working.

## Affiliate tracking

Every provider listing should retain its canonical product URL and, where authorized, an affiliate URL. Redirects must remain restricted to registered provider domains. Commission rates should come from configured affiliate program/reporting data rather than hard-coded assumptions.

## Rides

Uber/Ola/Rapido remain authorization-gated. Customer-assisted fare entry/screenshot extraction is allowed when live comparison APIs are unavailable. SmartBuy must not scrape competing mobile apps or bypass provider restrictions.
