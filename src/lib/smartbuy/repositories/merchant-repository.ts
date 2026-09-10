import { orm } from '@/lib/db';

export async function resolveMerchantIdBySlug(slug: string): Promise<string | null> {
  try {
    const merchant = await orm.Merchant.where({ slug }).select('id').first();
    return merchant?.id ?? null;
  } catch {
    return null;
  }
}

export async function getAllMerchants() {
  try {
    return await orm.Merchant.all();
  } catch {
    return [];
  }
}

export async function getAllProviders() {
  try {
    return await orm.Provider.all();
  } catch {
    return [];
  }
}
