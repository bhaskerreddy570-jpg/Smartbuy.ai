import { orm } from '@/lib/db';
import { getActiveProviderAdapters } from '@/lib/smartbuy/providers/registry';

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 5000;

export interface PriceAlertJobResult {
  processed: number;
  triggered: number;
  errors: number;
  skipped: number;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkAlertPrice(
  productTitle: string,
  targetPrice: number,
): Promise<{ price: number | null; source: string }> {
  const adapters = getActiveProviderAdapters();
  let lowest: number | null = null;
  let source = 'mock';

  for (const adapter of adapters) {
    const result = await adapter.search(productTitle, { rawQuery: productTitle });
    if (result.status !== 'OK') continue;
    for (const listing of result.listings) {
      if (listing.price != null && (lowest == null || listing.price < lowest)) {
        lowest = listing.price;
        source = adapter.slug;
      }
    }
  }

  return { price: lowest, source };
}

export async function runPriceAlertWorker(): Promise<PriceAlertJobResult> {
  const result: PriceAlertJobResult = { processed: 0, triggered: 0, errors: 0, skipped: 0 };

  let alerts: Array<{
    id: string;
    userId: string;
    productId: string;
    targetPrice: unknown;
    notificationChannel: string;
  }> = [];

  try {
    alerts = await orm.PriceAlert.where({ status: 'ACTIVE' }).all();
  } catch (error) {
    console.error('Price alert worker: failed to load alerts', error);
    return result;
  }

  for (const alert of alerts) {
    result.processed++;

    let product: { title: string } | null = null;
    try {
      product = await orm.Product.where({ id: alert.productId }).select('title').first();
    } catch {
      result.errors++;
      continue;
    }

    if (!product) {
      result.skipped++;
      continue;
    }

    let attempt = 0;
    let currentPrice: number | null = null;

    while (attempt < MAX_RETRIES) {
      try {
        const check = await checkAlertPrice(product.title, Number(alert.targetPrice));
        currentPrice = check.price;
        break;
      } catch {
        attempt++;
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt - 1));
        }
      }
    }

    if (currentPrice == null) {
      result.errors++;
      continue;
    }

    if (currentPrice <= Number(alert.targetPrice)) {
      try {
        await orm.PriceAlert.where({ id: alert.id }).update({
          status: 'TRIGGERED',
          triggeredAt: new Date().toISOString(),
        });

        await orm.SystemEvent.create({
          eventType: 'PRICE_ALERT_TRIGGERED',
          severity: 'INFO',
          message: `Price alert triggered for product ${alert.productId}: ₹${currentPrice}`,
          metadata: JSON.stringify({
            alertId: alert.id,
            userId: alert.userId,
            currentPrice,
            targetPrice: Number(alert.targetPrice),
          }),
        });

        await orm.Notification.create({
          userId: alert.userId,
          channel: alert.notificationChannel as 'EMAIL' | 'IN_APP' | 'PUSH',
          title: 'Price alert triggered',
          body: `Target price ₹${Number(alert.targetPrice).toLocaleString('en-IN')} reached (current ₹${currentPrice.toLocaleString('en-IN')}).`,
          metadata: JSON.stringify({
            alertId: alert.id,
            productId: alert.productId,
            currentPrice,
            targetPrice: Number(alert.targetPrice),
          }),
        });

        result.triggered++;
      } catch (error) {
        console.error('Failed to trigger alert', alert.id, error);
        result.errors++;
      }
    }
  }

  return result;
}
