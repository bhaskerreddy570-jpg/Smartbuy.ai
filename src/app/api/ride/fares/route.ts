import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { orm } from '@/lib/db';
import { compareRideFares } from '@/lib/smartbuy/ride-service';
import { getSiteName } from '@/lib/site-config';

const fareSchema = z.object({
  fares: z.array(
    z.object({
      providerSlug: z.string(),
      fare: z.number().positive(),
      etaMinutes: z.number().int().positive().optional(),
    }),
  ),
  sessionId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = fareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid fare data' }, { status: 400 });
    }

    const session = await auth();
    const comparison = compareRideFares(parsed.data.fares);

    for (const fare of parsed.data.fares) {
      try {
        await orm.CustomerSubmittedFare.create({
          userId: session?.user?.id ?? null,
          sessionId: parsed.data.sessionId ?? null,
          providerSlug: fare.providerSlug,
          fare: String(fare.fare),
          etaMinutes: fare.etaMinutes ?? null,
          tripDetails: null,
          confirmed: true,
        });
      } catch (error) {
        console.error('Failed to persist customer fare', error);
      }
    }

    const siteName = getSiteName();

    return NextResponse.json({
      ...comparison,
      dataSource: 'CUSTOMER_PROVIDED',
      disclaimer: `These fares were provided by you and are not independently verified by ${siteName}.`,
    });
  } catch (error) {
    console.error('Fare comparison failed', error);
    return NextResponse.json({ error: 'Unable to compare fares' }, { status: 500 });
  }
}
