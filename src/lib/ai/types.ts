import type { ParsedIntent, ProviderListing } from '@/lib/smartbuy/types';

export interface IntentParseResult {
  intent: ParsedIntent;
  confidence: number;
  source: 'ai' | 'deterministic';
}

export interface RecommendationExplanation {
  summary: string;
  bullets: string[];
  source: 'ai' | 'deterministic';
}

export interface FareExtractionResult {
  providerSlug?: string;
  fare?: number;
  etaMinutes?: number;
  currency: string;
  confidence: number;
  source: 'ai' | 'deterministic';
  rawText?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly available: boolean;

  parseIntent(query: string): Promise<IntentParseResult>;
  extractRequirements(query: string): Promise<Record<string, unknown>>;
  explainRecommendation(
    listing: ProviderListing,
    context: { query: string; intent: ParsedIntent },
  ): Promise<RecommendationExplanation>;
  extractFareFromScreenshot(
    imageBase64: string,
    mimeType: string,
  ): Promise<FareExtractionResult>;
}
