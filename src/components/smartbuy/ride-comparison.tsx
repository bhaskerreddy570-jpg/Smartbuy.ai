'use client';

import { useState } from 'react';

interface RideProvider {
  providerSlug: string;
  providerName: string;
  liveAvailable: boolean;
  deepLink?: string;
  dataSource: string;
}

export function RideComparison({
  providers,
  message,
}: {
  providers: RideProvider[];
  message: string;
}) {
  const [fares, setFares] = useState<Record<string, { fare: string; eta: string }>>({});
  const [comparison, setComparison] = useState<{
    bestPrice: { providerSlug: string; fare: number } | null;
    savings: Array<{ vsProvider: string; amount: number }>;
  } | null>(null);

  async function handleCompare() {
    const fareData = Object.entries(fares)
      .filter(([, v]) => v.fare)
      .map(([slug, v]) => ({
        providerSlug: slug,
        fare: parseFloat(v.fare),
        etaMinutes: v.eta ? parseInt(v.eta, 10) : undefined,
      }));

    if (fareData.length < 2) return;

    const res = await fetch('/api/ride/fares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fares: fareData }),
    });
    const data = await res.json();
    setComparison(data);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">{message}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {providers.map((p) => (
          <div key={p.providerSlug} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h3 className="font-semibold">{p.providerName}</h3>
            {p.deepLink && (
              <a
                href={p.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Check {p.providerName}
              </a>
            )}
            <div className="mt-3 space-y-2">
              <input
                type="number"
                placeholder="Fare (₹)"
                value={fares[p.providerSlug]?.fare ?? ''}
                onChange={(e) =>
                  setFares((prev) => ({
                    ...prev,
                    [p.providerSlug]: { ...prev[p.providerSlug], fare: e.target.value, eta: prev[p.providerSlug]?.eta ?? '' },
                  }))
                }
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="number"
                placeholder="ETA (min)"
                value={fares[p.providerSlug]?.eta ?? ''}
                onChange={(e) =>
                  setFares((prev) => ({
                    ...prev,
                    [p.providerSlug]: { fare: prev[p.providerSlug]?.fare ?? '', eta: e.target.value },
                  }))
                }
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleCompare}
        className="rounded-xl bg-emerald-600 px-6 py-2.5 font-medium text-white hover:bg-emerald-700"
      >
        Compare fares
      </button>

      {comparison?.bestPrice && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-700 dark:bg-emerald-950/20">
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">
            Best price: {comparison.bestPrice.providerSlug} — ₹{comparison.bestPrice.fare}
          </p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            Customer-provided information — not independently verified
          </p>
          {comparison.savings.map((s) => (
            <p key={s.vsProvider} className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Savings vs {s.vsProvider}: ₹{s.amount}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
