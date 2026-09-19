import type { ProviderAdapter } from './types';
import { createMockAdapter } from './mock-adapter';
import { createNotConfiguredAdapter } from './not-configured-adapter';
import {
  ECOMMERCE_PROVIDER_DEFINITIONS,
  RIDE_PROVIDER_DEFINITIONS,
  ALL_PROVIDER_DEFINITIONS,
  getProviderDefinition,
} from './definitions';
import { createAmazonCreatorsAdapter, hasAmazonCreatorsCredentials } from './adapters/amazon-creators-adapter';
import { createAuthorizedFeedAdapter } from './adapters/authorized-feed-adapter';
import { isMockProvidersEnabled } from '@/lib/site-config';

const adapterCache = new Map<string, ProviderAdapter>();

function providerEnvPrefix(slug: string): string {
  return slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function hasAuthorizedFeedEndpoint(slug: string): boolean {
  const prefix = providerEnvPrefix(slug);
  return Boolean(
    process.env[`${prefix}_API_BASE_URL`]?.trim() &&
    process.env[`${prefix}_API_TOKEN`]?.trim(),
  );
}

function resolveAdapter(def: typeof ALL_PROVIDER_DEFINITIONS[number]): ProviderAdapter {
  if (adapterCache.has(def.slug)) return adapterCache.get(def.slug)!;

  let adapter: ProviderAdapter;

  if (def.slug === 'amazon' && hasAmazonCreatorsCredentials()) {
    adapter = createAmazonCreatorsAdapter();
  } else if (def.category === 'RIDE_SERVICE') {
    adapter = createNotConfiguredAdapter(def);
  } else if (hasAuthorizedFeedEndpoint(def.slug)) {
    adapter = createAuthorizedFeedAdapter(def);
  } else if (isMockProvidersEnabled() && def.hasMockData) {
    adapter = createMockAdapter(def.slug);
  } else {
    adapter = createNotConfiguredAdapter(def);
  }

  adapterCache.set(def.slug, adapter);
  return adapter;
}

export function getProviderAdapter(slug: string): ProviderAdapter | null {
  const def = getProviderDefinition(slug);
  return def ? resolveAdapter(def) : null;
}

export function getActiveProviderAdapters(): ProviderAdapter[] {
  return ECOMMERCE_PROVIDER_DEFINITIONS.map(resolveAdapter);
}

export function getRideProviderAdapters(): ProviderAdapter[] {
  return RIDE_PROVIDER_DEFINITIONS.map(resolveAdapter);
}

export function getProviderSlugs(): string[] {
  return ALL_PROVIDER_DEFINITIONS.map((d) => d.slug);
}

export function getEcommerceProviderSlugs(): string[] {
  return ECOMMERCE_PROVIDER_DEFINITIONS.map((d) => d.slug);
}

export { ALL_PROVIDER_DEFINITIONS, ECOMMERCE_PROVIDER_DEFINITIONS, RIDE_PROVIDER_DEFINITIONS };
