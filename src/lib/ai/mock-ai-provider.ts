import { parseIntent } from '@/lib/smartbuy/intent-parser';
import type { AIProvider, FareExtractionResult, IntentParseResult, RecommendationExplanation } from './types';
import type { ParsedIntent, ProviderListing } from '@/lib/smartbuy/types';

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';
  readonly available = true;

  async parseIntent(query: string): Promise<IntentParseResult> {
    return {
      intent: parseIntent(query),
      confidence: 0.7,
      source: 'deterministic',
    };
  }

  async extractRequirements(query: string): Promise<Record<string, unknown>> {
    const intent = parseIntent(query);
    return {
      category: intent.category,
      brand: intent.brand,
      model: intent.model,
      budgetMax: intent.budgetMax,
      budgetMin: intent.budgetMin,
      queryType: intent.queryType,
      attributes: intent.attributes,
    };
  }

  async explainRecommendation(
    listing: ProviderListing,
    context: { query: string; intent: ParsedIntent },
  ): Promise<RecommendationExplanation> {
    const bullets: string[] = [];
    if (listing.price) bullets.push(`Current price: ₹${listing.price.toLocaleString('en-IN')}`);
    if (listing.rating) bullets.push(`Rated ${listing.rating}/5`);
    if (context.intent.budgetMax && listing.price && listing.price <= context.intent.budgetMax) {
      bullets.push('Within your stated budget');
    }
    return {
      summary: `${listing.title} matches your search for "${context.query}".`,
      bullets: bullets.length ? bullets : ['Matches your search criteria'],
      source: 'deterministic',
    };
  }

  async extractFareFromScreenshot(
    _imageBase64: string,
    _mimeType: string,
  ): Promise<FareExtractionResult> {
    return {
      currency: 'INR',
      confidence: 0,
      source: 'deterministic',
      rawText: 'Screenshot fare extraction requires an AI API key. Please enter fare manually.',
    };
  }
}
