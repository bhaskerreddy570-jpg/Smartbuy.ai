import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/components/providers';
import { WebsiteStructuredData, OrganizationStructuredData } from '@/components/seo/structured-data';
import { buildRootMetadata } from '@/lib/seo/metadata';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = buildRootMetadata();

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <WebsiteStructuredData />
        <OrganizationStructuredData />
      </head>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
