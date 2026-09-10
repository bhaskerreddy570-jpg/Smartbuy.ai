import { orm } from '@/lib/db';
import { calculatePriceHistoryStats } from '../price-history';
import type { PriceHistoryStats } from '../types';

export async function recordPriceObservation(input: {
  productId: string;
  merchantId: string;
  listingId: string;
  price: number;
  mrp?: number | null;
  availability?: string | null;
  source: string;
}): Promise<void> {
  try {
    await orm.PriceObservation.create({
      productId: input.productId,
      merchantId: input.merchantId,
      listingId: input.listingId,
      price: String(input.price),
      mrp: input.mrp != null ? String(input.mrp) : null,
      availability: input.availability ?? null,
      source: input.source,
    });
  } catch (error) {
    console.error('Failed to record price observation', error);
  }
}

export async function getPriceHistoryForProduct(
  productId: string,
  currentPrice?: number,
): Promise<PriceHistoryStats> {
  try {
    const observations = await orm.PriceObservation.where({ productId })
      .orderBy((o) => o.observedAt.desc())
      .all()
      .then((rows) => rows.slice(0, 500));

    return calculatePriceHistoryStats(
      observations.map((o) => ({
        price: Number(o.price),
        observedAt: new Date(o.observedAt),
      })),
      currentPrice,
    );
  } catch {
    return calculatePriceHistoryStats([], currentPrice);
  }
}
