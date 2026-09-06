import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { requestHasAdminSessionCookie } from '@/lib/admin/session-cookie';
import { resolveAuthSecret } from '@/lib/server-env';

function hasAdminSessionCookie(request: NextRequest): boolean {
  return requestHasAdminSessionCookie(request.headers.get('cookie'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
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

  const authSecret = resolveAuthSecret();
  const token = authSecret
    ? await getToken({
        req: request,
        secret: authSecret,
      })
    : null;

  const isLoggedIn = Boolean(token?.sub);
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isProtected = pathname.startsWith('/dashboard');

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.nextUrl));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register', '/admin', '/admin/:path*'],
};
