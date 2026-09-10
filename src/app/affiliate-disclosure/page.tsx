import { SmartBuyHeader } from '@/components/smartbuy/site-header';

export default function AffiliateDisclosurePage() {
  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 prose dark:prose-invert">
        <h1>Affiliate Disclosure</h1>
        <p>
          Some links on SmartBuy AI may be affiliate links. We may earn a commission if you
          purchase through them. Our recommendations are primarily based on customer value
          and product suitability; affiliate commission does not guarantee a higher ranking.
        </p>
        <p>
          When two or more options are genuinely suitable for the customer, we may prefer the
          legitimate affiliate option that produces better business economics. Customer
          satisfaction is always our primary objective.
        </p>
      </main>
    </>
  );
}
