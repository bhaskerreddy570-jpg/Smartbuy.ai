import { NextResponse } from 'next/server';
import { z } from 'zod';
import { orm } from '@/lib/db';

const postbackSchema = z.object({
  clickId: z.string().uuid(),
  externalOrderId: z.string().optional(),
  orderAmount: z.number().positive().optional(),
  state: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'PAID']),
  confirmedAmount: z.number().optional(),
  paidAmount: z.number().optional(),
  commissionRate: z.number().optional(),
});

/**
 * Affiliate network postback endpoint.
 * Protected by AFFILIATE_POSTBACK_SECRET when configured.
 */
export async function POST(request: Request) {
  const secret = process.env.AFFILIATE_POSTBACK_SECRET?.trim();
  if (secret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await request.json();
  const parsed = postbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid postback payload' }, { status: 400 });
  }

  const click = await orm.AffiliateClick.where({ clickId: parsed.data.clickId }).first();
  if (!click) {
    return NextResponse.json({ error: 'Click not found' }, { status: 404 });
  }

  let order = await orm.AffiliateOrder.where({ clickId: click.id }).first();
  if (!order) {
    order = await orm.AffiliateOrder.create({
      clickId: click.id,
      merchantId: click.merchantId,
      externalOrderId: parsed.data.externalOrderId ?? null,
      orderAmount: parsed.data.orderAmount != null ? String(parsed.data.orderAmount) : null,
      orderDate: new Date().toISOString(),
    });
  }

  const commission = await orm.AffiliateCommission.where({
    merchantId: click.merchantId,
    notes: `Click ${parsed.data.clickId}`,
  }).first();

  const updateData: Record<string, unknown> = {
    state: parsed.data.state,
    stateChangedAt: new Date().toISOString(),
  };

  if (parsed.data.confirmedAmount != null) {
    updateData.confirmedAmount = String(parsed.data.confirmedAmount);
  }
  if (parsed.data.paidAmount != null) {
    updateData.paidAmount = String(parsed.data.paidAmount);
  }
  if (parsed.data.commissionRate != null) {
    updateData.commissionRate = String(parsed.data.commissionRate);
  }
  if (parsed.data.orderAmount != null && parsed.data.commissionRate != null) {
    updateData.estimatedAmount = String(
      parsed.data.orderAmount * parsed.data.commissionRate,
    );
  }

  if (commission) {
    await orm.AffiliateCommission.where({ id: commission.id }).update(updateData);
  } else {
    await orm.AffiliateCommission.create({
      orderId: order.id,
      merchantId: click.merchantId,
      state: parsed.data.state,
      estimatedAmount:
        parsed.data.orderAmount != null && parsed.data.commissionRate != null
          ? String(parsed.data.orderAmount * parsed.data.commissionRate)
          : null,
      confirmedAmount: parsed.data.confirmedAmount != null ? String(parsed.data.confirmedAmount) : null,
      paidAmount: parsed.data.paidAmount != null ? String(parsed.data.paidAmount) : null,
      commissionRate: parsed.data.commissionRate != null ? String(parsed.data.commissionRate) : null,
      currency: 'INR',
      notes: `Postback for click ${parsed.data.clickId}`,
    });
  }

  return NextResponse.json({ ok: true });
}
