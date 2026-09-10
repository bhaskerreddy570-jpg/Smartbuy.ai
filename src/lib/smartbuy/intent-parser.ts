import type { ParsedIntent } from './types';

const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: string; subcategory?: string }> = [
  { pattern: /\b(iphone|samsung\s*galaxy|oneplus|smartphone|mobile\s*phone|phone)\b/i, category: 'smartphones', subcategory: 'mobile' },
  { pattern: /\b(laptop|notebook|macbook)\b/i, category: 'laptops' },
  { pattern: /\b(tv|television|smart\s*tv)\b/i, category: 'electronics', subcategory: 'television' },
  { pattern: /\b(washing\s*machine|washer)\b/i, category: 'home_appliances', subcategory: 'washing_machine' },
  { pattern: /\b(headphone|earphone|earbuds|airpods)\b/i, category: 'electronics', subcategory: 'audio' },
  { pattern: /\b(shoe|sneaker|footwear)\b/i, category: 'fashion', subcategory: 'footwear' },
  { pattern: /\b(flight|airline|fly)\b/i, category: 'travel', subcategory: 'flight' },
  { pattern: /\b(hotel|stay|accommodation)\b/i, category: 'travel', subcategory: 'hotel' },
  { pattern: /\b(bus|train)\b/i, category: 'travel' },
  { pattern: /\b(ride|cab|taxi|uber|ola|rapido|airport)\b/i, category: 'ride' },
];

const BRAND_PATTERNS: Array<{ pattern: RegExp; brand: string }> = [
  { pattern: /\b(apple|iphone|macbook|ipad)\b/i, brand: 'Apple' },
  { pattern: /\b(samsung)\b/i, brand: 'Samsung' },
  { pattern: /\b(asus)\b/i, brand: 'ASUS' },
  { pattern: /\b(lg)\b/i, brand: 'LG' },
  { pattern: /\b(oneplus)\b/i, brand: 'OnePlus' },
  { pattern: /\b(xiaomi|redmi)\b/i, brand: 'Xiaomi' },
];

const USE_CASE_PATTERNS: Array<{ pattern: RegExp; useCase: string }> = [
  { pattern: /\b(gaming|game)\b/i, useCase: 'gaming' },
  { pattern: /\b(programming|coding|developer|dev)\b/i, useCase: 'programming' },
  { pattern: /\b(camera|photography)\b/i, useCase: 'camera' },
  { pattern: /\b(family|household)\b/i, useCase: 'family' },
];

function extractBudget(query: string): { min?: number; max?: number } {
  const underMatch = query.match(/(?:under|below|upto|up\s*to|max|budget)\s*[₹rs.]?\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|lac|cr)?/i);
  if (underMatch) {
    let amount = parseFloat(underMatch[1].replace(/,/g, ''));
    const suffix = underMatch[2]?.toLowerCase();
    if (suffix === 'k') amount *= 1000;
    if (suffix === 'lakh' || suffix === 'lac') amount *= 100000;
    if (suffix === 'cr') amount *= 10000000;
    return { max: amount };
  }

  const rangeMatch = query.match(/[₹rs.]?\s*([\d,]+)\s*[-–to]+\s*[₹rs.]?\s*([\d,]+)/i);
  if (rangeMatch) {
    return {
      min: parseFloat(rangeMatch[1].replace(/,/g, '')),
      max: parseFloat(rangeMatch[2].replace(/,/g, '')),
    };
  }

  const plainAmount = query.match(/[₹rs.]\s*([\d,]+(?:\.\d+)?)\s*(k|lakh|lac)?/i);
  if (plainAmount) {
    let amount = parseFloat(plainAmount[1].replace(/,/g, ''));
    const suffix = plainAmount[2]?.toLowerCase();
    if (suffix === 'k') amount *= 1000;
    if (suffix === 'lakh' || suffix === 'lac') amount *= 100000;
    return { max: amount };
  }

  return {};
}

function extractAttributes(query: string): Record<string, string | number> {
  const attrs: Record<string, string | number> = {};

  const storageMatch = query.match(/(\d+)\s*(gb|tb)\b/i);
  if (storageMatch) {
    attrs.storage = `${storageMatch[1]}${storageMatch[2].toUpperCase()}`;
  }

  const ramMatch = query.match(/(\d+)\s*gb\s*ram/i);
  if (ramMatch) {
    attrs.ram = `${ramMatch[1]}GB`;
  }

  const screenMatch = query.match(/(\d+)\s*(?:inch|")\b/i);
  if (screenMatch) {
    attrs.screenSize = `${screenMatch[1]} inch`;
  }

  const colorMatch = query.match(/\b(black|white|blue|red|green|gold|silver|grey|gray)\b/i);
  if (colorMatch) {
    attrs.color = colorMatch[1];
  }

  return attrs;
}

function detectQueryType(query: string): ParsedIntent['queryType'] {
  if (/\b(ride|cab|taxi|uber|ola|rapido|airport)\b/i.test(query)) return 'ride';
  if (/\b(compare|vs|versus|cheapest|which\s+website|lowest\s+price)\b/i.test(query)) return 'compare';
  if (/\b(flight|hotel|travel|goa|mumbai|delhi|hyderabad)\b/i.test(query)) return 'travel';
  return 'product';
}

export function parseIntent(query: string): ParsedIntent {
  const intent: ParsedIntent = {
    rawQuery: query,
    queryType: detectQueryType(query),
    attributes: extractAttributes(query),
    priorities: [],
  };

  for (const { pattern, category, subcategory } of CATEGORY_PATTERNS) {
    if (pattern.test(query)) {
      intent.category = category;
      if (subcategory) intent.subcategory = subcategory;
      break;
    }
  }

  for (const { pattern, brand } of BRAND_PATTERNS) {
    if (pattern.test(query)) {
      intent.brand = brand;
      break;
    }
  }

  for (const { pattern, useCase } of USE_CASE_PATTERNS) {
    if (pattern.test(query)) {
      intent.useCase = useCase;
      break;
    }
  }

  const budget = extractBudget(query);
  if (budget.min) intent.budgetMin = budget.min;
  if (budget.max) intent.budgetMax = budget.max;

  if (/\b(cheapest|lowest\s+price|best\s+price)\b/i.test(query)) {
    intent.priorities!.push('price');
  }
  if (/\b(best|top|recommend)\b/i.test(query)) {
    intent.priorities!.push('quality');
  }
  if (/\b(camera)\b/i.test(query)) {
    intent.priorities!.push('camera');
  }

  const modelMatch = query.match(/\b(iphone\s*\d+|galaxy\s*\w+|tuf\s*f\d+)\b/i);
  if (modelMatch) {
    intent.model = modelMatch[1];
  }

  return intent;
}
