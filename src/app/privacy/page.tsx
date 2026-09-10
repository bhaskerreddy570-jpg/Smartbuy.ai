import { SmartBuyHeader } from '@/components/smartbuy/site-header';

export default function PrivacyPage() {
  return (
    <>
      <SmartBuyHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 prose dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-amber-700 dark:text-amber-300">
          <strong>Placeholder — requires legal review before production launch.</strong>
        </p>
        <h2>What we collect</h2>
        <ul>
          <li>Account information (email, name) when you register</li>
          <li>Search queries and browsing activity for improving recommendations</li>
          <li>Anonymous session data for analytics</li>
          <li>Affiliate click data for commission tracking</li>
        </ul>
        <h2>What we do not collect</h2>
        <ul>
          <li>Provider credentials (Uber/Ola login details)</li>
          <li>Unnecessary personal information</li>
        </ul>
        <h2>Customer-provided data</h2>
        <p>
          When you manually enter ride fares or upload screenshots, this data is clearly labeled
          as customer-provided and is not presented as independently verified.
        </p>
      </main>
    </>
  );
}
