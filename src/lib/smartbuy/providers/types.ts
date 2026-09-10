import type { ParsedIntent, ProviderListing, ProviderSearchResult } from '../types';

export interface ProviderAdapter {
  slug: string;
  name: string;
  category: string;
  supportedOperations: string[];

  search(query: string, intent: ParsedIntent): Promise<ProviderSearchResult>;
  getProduct?(merchantProductId: string): Promise<ProviderSearchResult>;
  getOffers?(merchantProductId: string): Promise<ProviderSearchResult>;
  getAvailability?(merchantProductId: string): Promise<{ status: string; availability?: string }>;
  getPrice?(merchantProductId: string): Promise<{ status: string; price?: number; mrp?: number }>;
  getAffiliateLink?(listing: ProviderListing): Promise<{ status: string; url?: string }>;
  getProductUrl?(listing: ProviderListing): string;
}

export type ProviderAdapterFactory = () => ProviderAdapter;
