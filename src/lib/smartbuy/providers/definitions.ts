export type ProviderCategoryType =
  | 'ECOMMERCE'
  | 'TRAVEL_FLIGHT'
  | 'TRAVEL_HOTEL'
  | 'TRAVEL_BUS'
  | 'TRAVEL_TRAIN'
  | 'CAR_RENTAL'
  | 'RIDE_SERVICE'
  | 'OTHER';

export interface ProviderDefinition {
  slug: string;
  name: string;
  category: ProviderCategoryType;
  baseUrl?: string;
  allowedDomains: string[];
  affiliateParam?: string;
  commissionRate: number;
  hasMockData: boolean;
  envCredentialKeys?: string[];
}

export const ECOMMERCE_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    slug: 'amazon',
    name: 'Amazon India',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.amazon.in',
    allowedDomains: ['amazon.in', 'www.amazon.in'],
    affiliateParam: 'tag',
    commissionRate: 0.02,
    hasMockData: true,
    envCredentialKeys: ['AMAZON_CREATORS_CLIENT_ID', 'AMAZON_CREATORS_CLIENT_SECRET', 'AMAZON_CREATORS_PARTNER_TAG'],
  },
  {
    slug: 'flipkart',
    name: 'Flipkart',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.flipkart.com',
    allowedDomains: ['flipkart.com', 'www.flipkart.com'],
    affiliateParam: 'affid',
    commissionRate: 0.03,
    hasMockData: true,
    envCredentialKeys: ['FLIPKART_API_KEY', 'FLIPKART_AFFILIATE_ID'],
  },
  {
    slug: 'croma',
    name: 'Croma',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.croma.com',
    allowedDomains: ['croma.com', 'www.croma.com'],
    affiliateParam: 'affid',
    commissionRate: 0.025,
    hasMockData: true,
    envCredentialKeys: ['CROMA_API_KEY'],
  },
  {
    slug: 'reliance-digital',
    name: 'Reliance Digital',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.reliancedigital.in',
    allowedDomains: ['reliancedigital.in', 'www.reliancedigital.in'],
    affiliateParam: 'affid',
    commissionRate: 0.02,
    hasMockData: false,
  },
  {
    slug: 'vijay-sales',
    name: 'Vijay Sales',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.vijaysales.com',
    allowedDomains: ['vijaysales.com', 'www.vijaysales.com'],
    commissionRate: 0.015,
    hasMockData: false,
  },
  {
    slug: 'tatacliq',
    name: 'Tata CLiQ',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.tatacliq.com',
    allowedDomains: ['tatacliq.com', 'www.tatacliq.com'],
    commissionRate: 0.02,
    hasMockData: false,
  },
  {
    slug: 'myntra',
    name: 'Myntra',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.myntra.com',
    allowedDomains: ['myntra.com', 'www.myntra.com'],
    commissionRate: 0.025,
    hasMockData: false,
  },
  {
    slug: 'ajio',
    name: 'AJIO',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.ajio.com',
    allowedDomains: ['ajio.com', 'www.ajio.com'],
    commissionRate: 0.02,
    hasMockData: false,
  },
  {
    slug: 'nykaa',
    name: 'Nykaa',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.nykaa.com',
    allowedDomains: ['nykaa.com', 'www.nykaa.com'],
    commissionRate: 0.03,
    hasMockData: false,
  },
  {
    slug: 'meesho',
    name: 'Meesho',
    category: 'ECOMMERCE',
    baseUrl: 'https://www.meesho.com',
    allowedDomains: ['meesho.com', 'www.meesho.com'],
    commissionRate: 0.02,
    hasMockData: false,
  },
];

export const RIDE_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    slug: 'uber',
    name: 'Uber',
    category: 'RIDE_SERVICE',
    baseUrl: 'https://m.uber.com',
    allowedDomains: ['uber.com', 'm.uber.com', 'www.uber.com'],
    commissionRate: 0,
    hasMockData: false,
  },
  {
    slug: 'ola',
    name: 'Ola',
    category: 'RIDE_SERVICE',
    baseUrl: 'https://book.olacabs.com',
    allowedDomains: ['olacabs.com', 'book.olacabs.com', 'www.olacabs.com'],
    commissionRate: 0,
    hasMockData: false,
  },
  {
    slug: 'rapido',
    name: 'Rapido',
    category: 'RIDE_SERVICE',
    baseUrl: 'https://rapido.bike',
    allowedDomains: ['rapido.bike', 'www.rapido.bike'],
    commissionRate: 0,
    hasMockData: false,
  },
];

export const ALL_PROVIDER_DEFINITIONS = [
  ...ECOMMERCE_PROVIDER_DEFINITIONS,
  ...RIDE_PROVIDER_DEFINITIONS,
];

export function getProviderDefinition(slug: string): ProviderDefinition | undefined {
  return ALL_PROVIDER_DEFINITIONS.find((p) => p.slug === slug);
}

export function getAllowedDomainsMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const def of ALL_PROVIDER_DEFINITIONS) {
    map[def.slug] = def.allowedDomains;
  }
  return map;
}
