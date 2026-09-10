import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildAffiliateUrl, isAllowedRedirectUrl } from '@/lib/smartbuy/affiliate-redirect';
import { MOCK_LISTINGS, MOCK_MERCHANTS } from '@/lib/smartbuy/providers/mock-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const merchantSlug = searchParams.get('merchant');
  const productId = searchParams.get('productId');
  const sessionId = searchParams.get('sessionId');

  if (!merchantSlug || !productId) {
    return NextResponse.json({ error: 'Missing merchant or productId' }, { status: 400 });
  }

  const listings = MOCK_LISTINGS[merchantSlug];
  if (!listings) {
    return NextResponse.json({ error: 'Unknown merchant' }, { status: 404 });
  }

  const listing = listings.find((l) => l.merchantProductId === productId);
  if (!listing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  if (!isAllowedRedirectUrl(listing.url, merchantSlug)) {
    return NextResponse.json({ error: 'Invalid redirect destination' }, { status: 400 });
  }

  const session = await auth();
  const clickId = crypto.randomUUID();

  // In production, persist AffiliateClick to database here.
  console.info('Affiliate click recorded', {
    clickId,
    userId: session?.user?.id,
    sessionId,
    merchantSlug,
    productId,
    destination: listing.url,
  });

  try {
    const { url } = buildAffiliateUrl(listing.url, merchantSlug);
    const merchant = MOCK_MERCHANTS[merchantSlug as keyof typeof MOCK_MERCHANTS];

    const response = NextResponse.redirect(url, 302);
    response.headers.set('X-SmartBuy-Click-Id', clickId);
    response.headers.set('X-SmartBuy-Merchant', merchant?.name ?? merchantSlug);
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to generate affiliate link' }, { status: 500 });
  }
}
