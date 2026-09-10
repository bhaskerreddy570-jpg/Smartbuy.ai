import { orm } from '@/lib/db';

export interface RecordClickInput {
  clickId: string;
  userId?: string | null;
  sessionId?: string | null;
  searchId?: string | null;
  productId?: string | null;
  listingId?: string | null;
  merchantId: string;
  affiliateProgram?: string | null;
  destinationUrl: string;
  affiliateUrlId?: string | null;
  deviceInfo?: string | null;
  ipAddress?: string | null;
}

export async function recordAffiliateClick(input: RecordClickInput): Promise<void> {
  try {
    await orm.AffiliateClick.create({
      clickId: input.clickId,
      userId: input.userId ?? null,
      sessionId: input.sessionId ?? null,
      searchId: input.searchId ?? null,
      productId: input.productId ?? null,
      listingId: input.listingId ?? null,
      merchantId: input.merchantId,
      affiliateProgram: input.affiliateProgram ?? null,
      destinationUrl: input.destinationUrl,
      affiliateUrlId: input.affiliateUrlId ?? null,
      deviceInfo: input.deviceInfo ?? null,
      ipAddress: input.ipAddress ?? null,
    });

    await orm.AffiliateCommission.create({
      merchantId: input.merchantId,
      state: 'CLICKED',
      currency: 'INR',
      notes: `Click ${input.clickId}`,
    });
  } catch (error) {
    console.error('Failed to persist affiliate click', error);
  }
}

export async function getAffiliateAnalyticsSummary() {
  try {
    const clicks = await orm.AffiliateClick.select('id', 'createdAt').all();
    const commissions = await orm.AffiliateCommission.select(
      'id',
      'state',
      'estimatedAmount',
      'confirmedAmount',
      'paidAmount',
    ).all();

    const estimated = commissions
      .filter((c) => c.estimatedAmount != null)
      .reduce((s, c) => s + Number(c.estimatedAmount ?? 0), 0);
    const confirmed = commissions
      .filter((c) => c.state === 'CONFIRMED' || c.state === 'PAID')
      .reduce((s, c) => s + Number(c.confirmedAmount ?? c.estimatedAmount ?? 0), 0);
    const paid = commissions
      .filter((c) => c.state === 'PAID')
      .reduce((s, c) => s + Number(c.paidAmount ?? c.confirmedAmount ?? 0), 0);

    return {
      totalClicks: clicks.length,
      estimatedRevenue: estimated,
      confirmedRevenue: confirmed,
      paidRevenue: paid,
      conversionRate:
        clicks.length > 0
          ? commissions.filter((c) => c.state !== 'CLICKED').length / clicks.length
          : 0,
    };
  } catch {
    return {
      totalClicks: 0,
      estimatedRevenue: 0,
      confirmedRevenue: 0,
      paidRevenue: 0,
      conversionRate: 0,
    };
  }
}
