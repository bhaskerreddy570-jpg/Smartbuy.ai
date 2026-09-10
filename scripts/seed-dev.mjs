#!/usr/bin/env node
/**
 * Development seed: providers, merchants, products, commission rules, system settings.
 * Run: node --import tsx scripts/seed-dev.mjs
 */
import 'dotenv/config';
import { getDb } from '../src/prisma/db.ts';

const ECOMMERCE_PROVIDERS = [
  { slug: 'amazon', name: 'Amazon India', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: true, allowedDomains: '["amazon.in","www.amazon.in"]' },
  { slug: 'flipkart', name: 'Flipkart', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: true, allowedDomains: '["flipkart.com","www.flipkart.com"]' },
  { slug: 'croma', name: 'Croma', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: true, allowedDomains: '["croma.com","www.croma.com"]' },
  { slug: 'reliance-digital', name: 'Reliance Digital', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["reliancedigital.in","www.reliancedigital.in"]' },
  { slug: 'vijay-sales', name: 'Vijay Sales', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["vijaysales.com","www.vijaysales.com"]' },
  { slug: 'tatacliq', name: 'Tata CLiQ', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["tatacliq.com","www.tatacliq.com"]' },
  { slug: 'myntra', name: 'Myntra', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["myntra.com","www.myntra.com"]' },
  { slug: 'ajio', name: 'AJIO', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["ajio.com","www.ajio.com"]' },
  { slug: 'nykaa', name: 'Nykaa', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["nykaa.com","www.nykaa.com"]' },
  { slug: 'meesho', name: 'Meesho', category: 'ECOMMERCE', dataMode: 'MOCK', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["meesho.com","www.meesho.com"]' },
];

const RIDE_PROVIDERS = [
  { slug: 'uber', name: 'Uber', category: 'RIDE_SERVICE', dataMode: 'CUSTOMER_PROVIDED', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["uber.com","m.uber.com"]' },
  { slug: 'ola', name: 'Ola', category: 'RIDE_SERVICE', dataMode: 'CUSTOMER_PROVIDED', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["olacabs.com","book.olacabs.com"]' },
  { slug: 'rapido', name: 'Rapido', category: 'RIDE_SERVICE', dataMode: 'CUSTOMER_PROVIDED', apiAvailable: false, affiliateAvailable: false, allowedDomains: '["rapido.bike","www.rapido.bike"]' },
];

const MERCHANTS = [
  { slug: 'amazon', providerSlug: 'amazon', affiliateId: 'smartbuy-21', commissionRate: 0.02 },
  { slug: 'flipkart', providerSlug: 'flipkart', affiliateId: 'smartbuy_fk', commissionRate: 0.03 },
  { slug: 'croma', providerSlug: 'croma', affiliateId: 'smartbuy_cr', commissionRate: 0.025 },
];

const PRODUCTS = [
  {
    title: 'Apple iPhone 17 256GB Black',
    brand: 'Apple',
    model: 'iPhone 17',
    category: 'smartphones',
    identifiers: { model: 'A3101', gtin: '0194253801234' },
    specs: { storage: '256GB', color: 'Black', ram: '8GB' },
  },
  {
    title: 'Samsung 55 Inch 4K Smart TV XYZ Series',
    brand: 'Samsung',
    model: 'XYZ55',
    category: 'electronics',
    identifiers: { model: 'UA55XYZ', gtin: '8806094567890' },
    specs: { screenSize: '55 inch', resolution: '4K UHD' },
  },
];

const SETTINGS = [
  { key: 'customer_score_weight', value: '0.75' },
  { key: 'business_score_weight', value: '0.25' },
  { key: 'match_confidence_threshold', value: '0.85' },
  { key: 'site_name', value: 'PROJECT_NAME_PLACEHOLDER' },
];

async function main() {
  const db = getDb();
  const orm = db.orm.public;

  console.log('Seeding providers...');
  const providerIds = {};
  for (const p of [...ECOMMERCE_PROVIDERS, ...RIDE_PROVIDERS]) {
    const existing = await orm.Provider.where({ slug: p.slug }).first();
    if (existing) {
      providerIds[p.slug] = existing.id;
      continue;
    }
    const created = await orm.Provider.create({
      slug: p.slug,
      name: p.name,
      category: p.category,
      status: p.apiAvailable ? 'ACTIVE' : 'NOT_SUPPORTED',
      dataMode: p.dataMode,
      apiAvailable: p.apiAvailable,
      affiliateAvailable: p.affiliateAvailable,
      supportedOperations: '["search"]',
      allowedDomains: p.allowedDomains,
    });
    providerIds[p.slug] = created.id;
  }

  console.log('Seeding affiliate program...');
  let program = await orm.AffiliateProgram.where({ name: 'SmartBuy Affiliate Network' }).first();
  if (!program) {
    program = await orm.AffiliateProgram.create({
      name: 'SmartBuy Affiliate Network',
      network: 'direct',
      status: 'ACTIVE',
      trackingParam: 'tag',
    });
  }

  console.log('Seeding merchants...');
  for (const m of MERCHANTS) {
    const existing = await orm.Merchant.where({ slug: m.slug }).first();
    if (existing) continue;
    const merchant = await orm.Merchant.create({
      providerId: providerIds[m.providerSlug],
      affiliateProgramId: program.id,
      slug: m.slug,
      name: m.providerSlug === 'amazon' ? 'Amazon India' : m.providerSlug === 'flipkart' ? 'Flipkart' : 'Croma',
      affiliateId: m.affiliateId,
      defaultCommissionRate: m.commissionRate,
      status: 'ACTIVE',
    });
    await orm.CommissionRule.create({
      merchantId: merchant.id,
      ratePercent: m.commissionRate,
      category: null,
    });
  }

  console.log('Seeding products...');
  for (const p of PRODUCTS) {
    const existing = await orm.Product.where({ title: p.title }).first();
    if (existing) continue;
    const product = await orm.Product.create({
      title: p.title,
      brand: p.brand,
      model: p.model,
      category: p.category,
      identifiers: JSON.stringify(p.identifiers),
      specifications: JSON.stringify(p.specs),
    });
    for (const [type, value] of Object.entries(p.identifiers)) {
      await orm.ProductIdentifier.create({ productId: product.id, type, value });
    }
  }

  console.log('Seeding system settings...');
  for (const s of SETTINGS) {
    const existing = await orm.SystemSetting.where({ key: s.key }).first();
    if (!existing) {
      await orm.SystemSetting.create({ key: s.key, value: s.value });
    }
  }

  console.log('Seed complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
