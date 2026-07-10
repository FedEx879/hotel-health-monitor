import { NextRequest, NextResponse } from 'next/server';
import { authToken, AUTH_COOKIE } from './app/lib/auth';

// Paths that must stay reachable without a session.
function isPublic(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/login') ||
    pathname.startsWith('/api/logout')
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  const expected = await authToken(process.env.APP_USERNAME ?? '', process.env.APP_PASSWORD ?? '');
  if (cookie && expected && cookie === expected) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

// Run on everything except Next internals and static files.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
