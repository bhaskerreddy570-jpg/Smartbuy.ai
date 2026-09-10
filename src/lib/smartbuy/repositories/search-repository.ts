import { orm } from '@/lib/db';
import type { ParsedIntent, RecommendationResult } from '../types';

export async function persistSearch(
  searchId: string,
  query: string,
  intent: ParsedIntent,
  userId?: string | null,
  sessionId?: string | null,
): Promise<void> {
  try {
    await orm.Search.create({
      id: searchId,
      userId: userId ?? null,
      sessionId: sessionId ?? null,
      query,
      parsedIntent: JSON.stringify(intent),
      category: intent.category ?? null,
      status: 'PROCESSING',
    });
  } catch (error) {
    console.error('Failed to persist search', error);
  }
}

export async function completeSearch(
  searchId: string,
  recommendations: RecommendationResult,
): Promise<void> {
  try {
    for (const [index, item] of recommendations.allListings.entries()) {
      await orm.SearchResult.create({
        searchId,
        rank: index + 1,
        customerScore: String(item.customerScore),
        businessScore: String(item.businessScore),
        combinedScore: String(item.combinedScore),
        badge: item.badge ?? null,
        explanation: item.explanation.join('; '),
        productId: item.canonicalProductId ?? null,
        listingId: null,
      });
    }

    await orm.Search.where({ id: searchId }).update({
      status: 'COMPLETED',
      resultCount: recommendations.allListings.length,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to complete search persistence', error);
    try {
      await orm.Search.where({ id: searchId }).update({ status: 'PARTIAL' });
    } catch {
      /* ignore */
    }
  }
}

export async function getUserSearchHistory(userId: string, limit = 20) {
  try {
    const all = await orm.Search.where({ userId })
      .orderBy((s) => s.createdAt.desc())
      .all();
    return all.slice(0, limit);
  } catch {
    return [];
  }
}
