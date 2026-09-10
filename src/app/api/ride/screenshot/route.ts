import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getAIProvider } from '@/lib/ai';
import { orm } from '@/lib/db';

const schema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  imageBase64: z.string().min(100),
  providerSlug: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid screenshot payload' }, { status: 400 });
  }

  const ai = getAIProvider();
  const extraction = await ai.extractFareFromScreenshot(
    parsed.data.imageBase64,
    parsed.data.mimeType,
  );

  const storageKey = `customer-screenshots/${crypto.randomUUID()}-${parsed.data.fileName}`;

  try {
    await orm.CustomerScreenshot.create({
      userId: session?.user?.id ?? null,
      sessionId: null,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      storageKey,
      extractedData: JSON.stringify({
        ...extraction,
        label: 'CUSTOMER_PROVIDED',
        disclaimer: 'Fare extracted from customer-provided screenshot. Not independently verified.',
      }),
      confirmed: false,
    });
  } catch (error) {
    console.error('Failed to persist screenshot metadata', error);
  }

  return NextResponse.json({
    extraction: {
      ...extraction,
      label: 'CUSTOMER_PROVIDED',
      disclaimer:
        'This fare was extracted from your screenshot. SmartBuy AI has not independently verified it with the ride provider.',
    },
  });
}
