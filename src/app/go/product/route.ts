import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  buildAffiliateUrl,
  isAllowedRedirectUrl,
  validateRedirectParams,
} from '@/lib/smartbuy/affiliate-redirect';
import { MOCK_LISTINGS, MOCK_MERCHANTS } from '@/lib/smartbuy/providers/mock-data';
import { recordAffiliateClick } from '@/lib/smartbuy/repositories/affiliate-repository';
import { resolveMerchantIdBySlug } from '@/lib/smartbuy/repositories/merchant-repository';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const merchantSlug = searchParams.get('merchant');
  const productId = searchParams.get('productId');
  const sessionId = searchParams.get('sessionId');
  const searchId = searchParams.get('searchId');

  if (!validateRedirectParams(merchantSlug, productId)) {
    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  }

  const listings = MOCK_LISTINGS[merchantSlug!];
  if (!listings) {
    return NextResponse.json({ error: 'Unknown merchant' }, { status: 404 });
  }

  const listing = listings.find((l) => l.merchantProductId === productId);
  if (!listing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  if (!isAllowedRedirectUrl(listing.url, merchantSlug!)) {
    return NextResponse.json({ error: 'Invalid redirect destination' }, { status: 400 });
  }

  const session = await auth();
  const clickId = crypto.randomUUID();
  const merchantId = await resolveMerchantIdBySlug(merchantSlug!);

  if (merchantId) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    const userAgent = request.headers.get('user-agent');

    await recordAffiliateClick({
      clickId,
      userId: session?.user?.id ?? null,
      sessionId,
      searchId,
      merchantId,
      destinationUrl: listing.url,
      ipAddress: ip,
      deviceInfo: userAgent,
      affiliateProgram: MOCK_MERCHANTS[merchantSlug as keyof typeof MOCK_MERCHANTS]?.name ?? merchantSlug,
    });
  } else {
    console.info('Affiliate click (merchant not in DB)', {
      clickId,
      merchantSlug,
      productId,
    });
  }

  try {
    const { url } = buildAffiliateUrl(listing.url, merchantSlug!);
    const merchant = MOCK_MERCHANTS[merchantSlug as keyof typeof MOCK_MERCHANTS];

    const response = NextResponse.redirect(url, 302);
    response.headers.set('X-Affiliate-Click-Id', clickId);
    response.headers.set('X-Merchant', merchant?.name ?? merchantSlug!);
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to generate affiliate link' }, { status: 500 });
  }
}
