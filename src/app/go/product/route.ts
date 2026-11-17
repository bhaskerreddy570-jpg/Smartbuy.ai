import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  buildAffiliateUrl,
  isAllowedRedirectUrl,
  validateRedirectParams,
} from '@/lib/smartbuy/affiliate-redirect';
import { hasAmazonCreatorsCredentials } from '@/lib/smartbuy/providers/adapters/amazon-creators-adapter';
import { getProviderAdapter } from '@/lib/smartbuy/providers/registry';
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

  const adapter = getProviderAdapter(merchantSlug!);
  if (!adapter) {
    return NextResponse.json({ error: 'Unknown merchant' }, { status: 404 });
  }
  if (!adapter.getProduct) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const product = await adapter.getProduct(productId!);
  const listing = product.status === 'OK' ? product.listings[0] : undefined;
  if (!listing?.url) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  if (!isAllowedRedirectUrl(listing.url, merchantSlug!)) {
    return NextResponse.json({ error: 'Invalid redirect destination' }, { status: 400 });
  }

  let destinationUrl: string;
  try {
    if (merchantSlug === 'amazon' && hasAmazonCreatorsCredentials() && adapter.getAffiliateLink) {
      const link = await adapter.getAffiliateLink(listing);
      if (!link.url || !isAllowedRedirectUrl(link.url, merchantSlug)) {
        return NextResponse.json({ error: 'Invalid redirect destination' }, { status: 400 });
      }
      destinationUrl = link.url;
    } else {
      destinationUrl = buildAffiliateUrl(listing.url, merchantSlug!).url;
    }
  } catch {
    return NextResponse.json({ error: 'Unable to generate affiliate link' }, { status: 500 });
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
      destinationUrl,
      ipAddress: ip,
      deviceInfo: userAgent,
      affiliateProgram: adapter.name,
    });
  } else {
    console.info('Affiliate click (merchant not in DB)', {
      clickId,
      merchantSlug,
      productId,
    });
  }

  const response = NextResponse.redirect(destinationUrl, 302);
  response.headers.set('X-Affiliate-Click-Id', clickId);
  response.headers.set('X-Merchant', adapter.name);
  return response;
}
