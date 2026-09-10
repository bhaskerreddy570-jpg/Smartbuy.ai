import { parseIntent } from '@/lib/smartbuy/intent-parser';
import type { AIProvider, FareExtractionResult, IntentParseResult, RecommendationExplanation } from './types';
import type { ParsedIntent, ProviderListing } from '@/lib/smartbuy/types';

export class OpenAICompatibleProvider implements AIProvider {
  readonly name = 'openai-compatible';
  readonly available: boolean;

  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.AI_API_KEY?.trim() ?? '';
    this.apiUrl = (process.env.AI_API_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = process.env.AI_MODEL?.trim() || 'gpt-4o-mini';
    this.available = this.apiKey.length > 0;
  }

  private async chat(system: string, user: string): Promise<string | null> {
    if (!this.available) return null;
    try {
      const res = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.2,
          max_tokens: 800,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return data.choices?.[0]?.message?.content ?? null;
    } catch {
      return null;
    }
  }

  async parseIntent(query: string): Promise<IntentParseResult> {
    const fallback = parseIntent(query);
    const content = await this.chat(
      'Extract shopping intent as JSON: category, brand, model, budgetMin, budgetMax, queryType (product|compare|ride|travel|general). Return only JSON.',
      query,
    );
    if (!content) {
      return { intent: fallback, confidence: 0.7, source: 'deterministic' };
    }
    try {
      const parsed = JSON.parse(content) as Partial<ParsedIntent>;
      return {
        intent: { ...fallback, ...parsed, rawQuery: query },
        confidence: 0.85,
        source: 'ai',
      };
    } catch {
      return { intent: fallback, confidence: 0.7, source: 'deterministic' };
    }
  }

  async extractRequirements(query: string): Promise<Record<string, unknown>> {
    const { intent } = await this.parseIntent(query);
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
    const mock = new (await import('./mock-ai-provider')).MockAIProvider();
    const content = await this.chat(
      'Explain why this product is recommended in 2-3 bullet points for an Indian shopper. Be factual, no invented specs.',
      `Query: ${context.query}\nProduct: ${listing.title}\nPrice: ${listing.price ?? 'unknown'} INR`,
    );
    if (!content) return mock.explainRecommendation(listing, context);
    return {
      summary: content.split('\n')[0] ?? listing.title,
      bullets: content.split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('•')),
      source: 'ai',
    };
  }

  async extractFareFromScreenshot(
    imageBase64: string,
    mimeType: string,
  ): Promise<FareExtractionResult> {
    if (!this.available) {
      return {
        currency: 'INR',
        confidence: 0,
        source: 'deterministic',
        rawText: 'AI API key not configured',
      };
    }
    // Vision requires multimodal API — return structured not-supported for now
    return {
      currency: 'INR',
      confidence: 0,
      source: 'deterministic',
      rawText: `Received ${mimeType} image (${imageBase64.length} bytes). Vision extraction pending authorized AI vision API.`,
    };
  }
}
