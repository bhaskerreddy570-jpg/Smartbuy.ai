# Affiliate System

## Click flow

```
Customer → /go/product?merchant=flipkart&productId=FK-IPH17-256-BLK
         → Validate merchant domain
         → Record click (AffiliateClick)
         → Build authorized affiliate URL server-side
         → 302 redirect
```

## Commission states

CLICKED → PENDING → CONFIRMED → PAID (or REJECTED / CANCELLED)

Never display estimated commission to customers.

## Expected commission (internal)

```
expected = price × commissionRate × conversionProbability × (1 - cancellationRate)
```

## Configuration

Commission rules are data-driven via `CommissionRule` table. Admin can update rates by category/product without code changes.
