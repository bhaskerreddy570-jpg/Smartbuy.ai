import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { executeSearch } from '@/lib/smartbuy/search-service';
import { getRideProviders } from '@/lib/smartbuy/ride-service';
import { parseIntent } from '@/lib/smartbuy/intent-parser';

const searchSchema = z.object({
  query: z.string().trim().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = searchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }

    const session = await auth();
    const intent = parseIntent(parsed.data.query);

    if (intent.queryType === 'ride') {
      const providers = getRideProviders();
      return NextResponse.json({
        searchId: crypto.randomUUID(),
        query: parsed.data.query,
        intent,
        type: 'ride',
        providers,
        message: 'Live fare is not available through our authorized connection. Check providers manually or enter fares below.',
      });
    }

    const result = await executeSearch(parsed.data.query);

    return NextResponse.json({
      ...result,
      type: 'product',
      userId: session?.user?.id ?? null,
    });
  } catch (error) {
    console.error('Search failed', error);
    return NextResponse.json(
      { error: 'Unable to retrieve live results right now.' },
      { status: 500 },
    );
  }
}
