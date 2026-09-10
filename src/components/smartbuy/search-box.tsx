'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const EXAMPLE_QUERIES = [
  'Best laptop under ₹70,000',
  'Find the cheapest iPhone',
  'Best TV for PS5',
  'Compare ride options',
  'Find a hotel in Goa',
];

export function SearchBox({ large = false }: { large?: boolean }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you looking for?"
          className={`w-full rounded-2xl border border-zinc-200 bg-white px-5 text-zinc-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 ${
            large ? 'py-4 text-lg' : 'py-3 text-base'
          }`}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-emerald-600 px-5 font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50 ${
            large ? 'py-2.5' : 'py-2'
          }`}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
      {large && (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuery(example)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
