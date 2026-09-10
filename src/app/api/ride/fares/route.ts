import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compareRideFares } from '@/lib/smartbuy/ride-service';

const fareSchema = z.object({
  fares: z.array(
    z.object({
      providerSlug: z.string(),
      fare: z.number().positive(),
      etaMinutes: z.number().int().positive().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = fareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid fare data' }, { status: 400 });
    }

    const comparison = compareRideFares(parsed.data.fares);

    return NextResponse.json({
      ...comparison,
      dataSource: 'CUSTOMER_PROVIDED',
      disclaimer: 'These fares were provided by you and are not independently verified by SmartBuy AI.',
    });
  } catch (error) {
    console.error('Fare comparison failed', error);
    return NextResponse.json({ error: 'Unable to compare fares' }, { status: 500 });
  }
}
