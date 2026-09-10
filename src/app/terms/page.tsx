import { SmartBuyHeader } from '@/components/smartbuy/site-header';

export default function TermsPage() {
  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 prose dark:prose-invert">
        <h1>Terms of Service</h1>
        <p className="text-amber-700 dark:text-amber-300">
          <strong>Placeholder — requires legal review before production launch.</strong>
        </p>
        <p>
          SmartBuy AI provides product comparison and purchasing recommendations.
          Prices and availability are sourced from authorized providers and may change.
          We do not guarantee accuracy of third-party data.
        </p>
      </main>
    </>
  );
}
