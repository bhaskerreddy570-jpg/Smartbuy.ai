import { getAIProvider } from '@/lib/ai';

export default async function AdminAIConfigPage() {
  const provider = getAIProvider();
  const hasApiKey = Boolean(process.env.AI_API_KEY);
  const model = process.env.AI_MODEL ?? 'gpt-4o-mini';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">AI configuration</h1>
        <p className="mt-1 text-sm text-zinc-500">
          AI is optional. Deterministic logic handles arithmetic, savings, and commission calculations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Active provider</p>
          <p className="mt-2 text-lg font-semibold">{provider.name}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">API key configured</p>
          <p className={`mt-2 text-lg font-semibold ${hasApiKey ? 'text-emerald-600' : 'text-amber-600'}`}>
            {hasApiKey ? 'Yes' : 'No — using mock/deterministic'}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs uppercase text-zinc-500">Model</p>
          <p className="mt-2 text-lg font-semibold">{model}</p>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Supported operations</h2>
        <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
          <li>parseIntent — natural language search understanding</li>
          <li>extractRequirements — structured requirement extraction</li>
          <li>explainRecommendation — human-readable recommendation rationale</li>
          <li>extractFareFromScreenshot — customer-provided ride fare OCR (vision)</li>
        </ul>
        <p className="mt-4 text-xs text-zinc-500">
          Set AI_API_KEY in environment variables. Never expose API keys to the frontend.
        </p>
      </section>
    </div>
  );
}
