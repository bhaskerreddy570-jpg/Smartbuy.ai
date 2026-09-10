import type { ProviderAdapter } from './types';
import { createMockAdapter } from './mock-adapter';

const MOCK_PROVIDERS = ['amazon', 'flipkart', 'croma'] as const;

const adapterCache = new Map<string, ProviderAdapter>();

export function getProviderAdapter(slug: string): ProviderAdapter | null {
  if (adapterCache.has(slug)) {
    return adapterCache.get(slug)!;
  }

  if (MOCK_PROVIDERS.includes(slug as typeof MOCK_PROVIDERS[number])) {
    const adapter = createMockAdapter(slug);
    adapterCache.set(slug, adapter);
    return adapter;
  }

  return null;
}

export function getActiveProviderAdapters(): ProviderAdapter[] {
  return MOCK_PROVIDERS.map((slug) => getProviderAdapter(slug)!).filter(Boolean);
}

export function getProviderSlugs(): string[] {
  return [...MOCK_PROVIDERS];
}
