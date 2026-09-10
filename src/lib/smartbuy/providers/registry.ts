import type { ProviderAdapter } from './types';
import { createMockAdapter } from './mock-adapter';
import { createNotConfiguredAdapter } from './not-configured-adapter';
import { hasAuthorizedCredentials } from './credential-check';
import {
  ALL_PROVIDER_DEFINITIONS,
  ECOMMERCE_PROVIDER_DEFINITIONS,
  RIDE_PROVIDER_DEFINITIONS,
  getProviderDefinition,
} from './definitions';
import { isMockProvidersEnabled } from '@/lib/site-config';

const adapterCache = new Map<string, ProviderAdapter>();

function resolveAdapter(def: typeof ALL_PROVIDER_DEFINITIONS[number]): ProviderAdapter {
  if (adapterCache.has(def.slug)) {
    return adapterCache.get(def.slug)!;
  }

  let adapter: ProviderAdapter;

  if (def.category === 'RIDE_SERVICE') {
    adapter = createNotConfiguredAdapter(def);
  } else if (isMockProvidersEnabled() && def.hasMockData) {
    adapter = createMockAdapter(def.slug);
  } else if (hasAuthorizedCredentials(def)) {
    // Real adapter would be loaded here when credentials exist.
    // Until implemented, fall back to not-configured rather than faking data.
    adapter = createNotConfiguredAdapter(def);
  } else {
    adapter = createNotConfiguredAdapter(def);
  }

  adapterCache.set(def.slug, adapter);
  return adapter;
}

export function getProviderAdapter(slug: string): ProviderAdapter | null {
  const def = getProviderDefinition(slug);
  if (!def) return null;
  return resolveAdapter(def);
}

export function getActiveProviderAdapters(): ProviderAdapter[] {
  return ECOMMERCE_PROVIDER_DEFINITIONS.map((def) => resolveAdapter(def));
}

export function getRideProviderAdapters(): ProviderAdapter[] {
  return RIDE_PROVIDER_DEFINITIONS.map((def) => resolveAdapter(def));
}

export function getProviderSlugs(): string[] {
  return ALL_PROVIDER_DEFINITIONS.map((d) => d.slug);
}

export function getEcommerceProviderSlugs(): string[] {
  return ECOMMERCE_PROVIDER_DEFINITIONS.map((d) => d.slug);
}

export { ALL_PROVIDER_DEFINITIONS, ECOMMERCE_PROVIDER_DEFINITIONS, RIDE_PROVIDER_DEFINITIONS };
