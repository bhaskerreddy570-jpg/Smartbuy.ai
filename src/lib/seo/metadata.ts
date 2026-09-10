import type { Metadata } from 'next';
import { getSiteDescription, getSiteName, getSiteUrl } from '@/lib/site-config';

export function buildRootMetadata(): Metadata {
  const siteName = getSiteName();
  const siteUrl = getSiteUrl();
  const description = getSiteDescription();

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical: siteUrl },
    openGraph: {
      type: 'website',
      locale: 'en_IN',
      url: siteUrl,
      siteName,
      title: siteName,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: siteName,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export function buildPageMetadata(title: string, description?: string, path?: string): Metadata {
  const siteUrl = getSiteUrl();
  const canonical = path ? `${siteUrl}${path.startsWith('/') ? path : `/${path}`}` : siteUrl;
  return {
    title,
    description: description ?? getSiteDescription(),
    alternates: { canonical },
    openGraph: {
      title,
      description: description ?? getSiteDescription(),
      url: canonical,
    },
  };
}
