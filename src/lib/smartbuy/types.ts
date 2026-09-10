export type ProviderOperationStatus = 'OK' | 'NOT_SUPPORTED' | 'ERROR' | 'UNAVAILABLE';

export interface ParsedIntent {
  category?: string;
  subcategory?: string;
  budgetMin?: number;
  budgetMax?: number;
  brand?: string;
  model?: string;
  useCase?: string;
  priorities?: string[];
  attributes?: Record<string, string | number>;
  queryType?: 'product' | 'compare' | 'travel' | 'ride' | 'general';
  rawQuery: string;
}

export interface ProviderListing {
  merchantProductId: string;
  title: string;
  brand?: string;
  model?: string;
  category: string;
  subcategory?: string;
  price?: number;
  mrp?: number;
  currency: string;
  availability?: string;
  seller?: string;
  sellerRating?: number;
  warranty?: string;
  returnPolicy?: string;
  deliveryInfo?: string;
  rating?: number;
  reviewCount?: number;
  url: string;
  affiliateUrl?: string;
  imageUrl?: string;
  specifications?: Record<string, string>;
  identifiers?: Record<string, string>;
  dataFreshness: 'LIVE' | 'CACHED' | 'HISTORICAL' | 'CUSTOMER_PROVIDED' | 'ESTIMATED' | 'UNAVAILABLE';
  sourceTimestamp?: Date;
}

export interface ProviderSearchResult {
  status: ProviderOperationStatus;
  listings: ProviderListing[];
  message?: string;
  providerSlug: string;
}

export interface MatchResult {
  listingA: ProviderListing;
  listingB: ProviderListing;
  confidence: number;
  matchedIdentifiers: string[];
  isSameProduct: boolean;
}

export interface ScoredListing {
  listing: ProviderListing;
  merchantSlug: string;
  merchantName: string;
  customerScore: number;
  businessScore: number;
  combinedScore: number;
  canonicalProductId?: string;
  matchConfidence?: number;
  savingsVsHighest?: number;
  savingsPercent?: number;
  badge?: 'BEST_OVERALL' | 'CHEAPEST' | 'BEST_VALUE';
  explanation: string[];
  dataFreshnessLabel: string;
}

export interface RecommendationResult {
  bestOverall: ScoredListing | null;
  cheapest: ScoredListing | null;
  allListings: ScoredListing[];
  matchedGroups: Array<{
    canonicalKey: string;
    listings: ScoredListing[];
    matchConfidence: number;
  }>;
}

export interface CommissionEstimate {
  estimatedCommission: number;
  commissionRate: number;
  conversionProbability: number;
  cancellationRate: number;
}

export interface PriceHistoryStats {
  currentPrice: number | null;
  avg7Day: number | null;
  avg30Day: number | null;
  low30Day: number | null;
  low90Day: number | null;
  highHistorical: number | null;
  trend: 'rising' | 'falling' | 'stable' | 'unknown';
  observationCount: number;
  buyRecommendation: 'buy' | 'wait' | 'insufficient_data';
  buyRecommendationText: string;
}

export interface RideFareEntry {
  providerSlug: string;
  providerName: string;
  fare?: number;
  etaMinutes?: number;
  liveAvailable: boolean;
  deepLink?: string;
  dataSource: 'LIVE' | 'CUSTOMER_PROVIDED' | 'UNAVAILABLE';
}

export interface RecommendationWeights {
  customerWeight: number;
  businessWeight: number;
  matchConfidenceThreshold: number;
}
