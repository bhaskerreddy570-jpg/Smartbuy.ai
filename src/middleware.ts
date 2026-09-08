import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requestHasAdminSessionCookie } from '@/lib/admin/session-cookie';

function hasAdminSessionCookie(request: NextRequest): boolean {
  return requestHasAdminSessionCookie(request.headers.get('cookie'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const isAdminLogin = pathname === '/admin/login';

  if (isAdminLogin && hasAdminSessionCookie(request)) {
    return NextResponse.redirect(new URL('/admin', request.nextUrl));
  }

  if (!isAdminLogin && !hasAdminSessionCookie(request)) {
    return NextResponse.redirect(new URL('/admin/login', request.nextUrl));
  }

  if (
    pathname === '/admin/recovery-handoff' &&
    !hasAdminSessionCookie(request)
  ) {
    return NextResponse.redirect(new URL('/admin/login', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
