import type { AIProvider } from './types';
import { MockAIProvider } from './mock-ai-provider';
import { OpenAICompatibleProvider } from './openai-provider';

let cachedProvider: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cachedProvider) return cachedProvider;

  const openai = new OpenAICompatibleProvider();
  cachedProvider = openai.available ? openai : new MockAIProvider();
  return cachedProvider;
}

export type { AIProvider, IntentParseResult, FareExtractionResult, RecommendationExplanation } from './types';
