import type { MatchResult, ProviderListing } from './types';

const IDENTIFIER_WEIGHTS: Record<string, number> = {
  gtin: 0.35,
  ean: 0.35,
  upc: 0.35,
  model: 0.25,
  mpn: 0.25,
  sku: 0.15,
};

const ATTRIBUTE_WEIGHTS: Record<string, number> = {
  storage: 0.15,
  color: 0.1,
  ram: 0.1,
  screenSize: 0.08,
  capacity: 0.08,
};

function normalizeString(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeString(a).match(/[a-z0-9]{2,}/g) ?? []);
  const wordsB = new Set(normalizeString(b).match(/[a-z0-9]{2,}/g) ?? []);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

export function matchListings(
  listingA: ProviderListing,
  listingB: ProviderListing,
  threshold = 0.85,
): MatchResult {
  let score = 0;
  const matchedIdentifiers: string[] = [];

  if (listingA.brand && listingB.brand) {
    if (normalizeString(listingA.brand) === normalizeString(listingB.brand)) {
      score += 0.1;
    } else {
      return {
        listingA,
        listingB,
        confidence: 0,
        matchedIdentifiers: [],
        isSameProduct: false,
      };
    }
  }

  const idsA = listingA.identifiers ?? {};
  const idsB = listingB.identifiers ?? {};

  for (const [key, weight] of Object.entries(IDENTIFIER_WEIGHTS)) {
    const valA = idsA[key];
    const valB = idsB[key];
    if (valA && valB) {
      if (normalizeString(valA) === normalizeString(valB)) {
        score += weight;
        matchedIdentifiers.push(key);
      } else {
        return {
          listingA,
          listingB,
          confidence: 0,
          matchedIdentifiers: [],
          isSameProduct: false,
        };
      }
    }
  }

  const specsA = listingA.specifications ?? {};
  const specsB = listingB.specifications ?? {};

  for (const [key, weight] of Object.entries(ATTRIBUTE_WEIGHTS)) {
    const valA = specsA[key];
    const valB = specsB[key];
    if (valA && valB) {
      if (normalizeString(String(valA)) === normalizeString(String(valB))) {
        score += weight;
        matchedIdentifiers.push(`spec:${key}`);
      } else {
        return {
          listingA,
          listingB,
          confidence: 0,
          matchedIdentifiers: [],
          isSameProduct: false,
        };
      }
    }
  }

  const titleSim = titleSimilarity(listingA.title, listingB.title);
  score += titleSim * 0.15;

  const confidence = Math.min(score, 1);

  return {
    listingA,
    listingB,
    confidence,
    matchedIdentifiers,
    isSameProduct: confidence >= threshold,
  };
}

export function groupListingsByProduct(
  listings: Array<{ listing: ProviderListing; merchantSlug: string }>,
  threshold = 0.85,
): Array<{
  canonicalKey: string;
  listings: Array<{ listing: ProviderListing; merchantSlug: string }>;
  matchConfidence: number;
}> {
  const groups: Array<{
    canonicalKey: string;
    listings: Array<{ listing: ProviderListing; merchantSlug: string }>;
    matchConfidence: number;
  }> = [];

  const assigned = new Set<number>();

  for (let i = 0; i < listings.length; i++) {
    if (assigned.has(i)) continue;

    const group = [listings[i]];
    assigned.add(i);
    let minConfidence = 1;

    for (let j = i + 1; j < listings.length; j++) {
      if (assigned.has(j)) continue;

      const match = matchListings(listings[i].listing, listings[j].listing, threshold);
      if (match.isSameProduct) {
        group.push(listings[j]);
        assigned.add(j);
        minConfidence = Math.min(minConfidence, match.confidence);
      }
    }

    const key = listings[i].listing.identifiers?.gtin
      ?? listings[i].listing.identifiers?.model
      ?? `${listings[i].listing.brand}-${listings[i].listing.model}-${listings[i].listing.specifications?.storage ?? 'default'}`;

    groups.push({
      canonicalKey: key,
      listings: group,
      matchConfidence: group.length > 1 ? minConfidence : 1,
    });
  }

  return groups;
}
