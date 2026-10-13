import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api routes, and public pages
  if (
    pathname === '/login' ||
    pathname === '/' ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check demo mode environment variable or session cookie
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const session = request.cookies.get('session')?.value;

  // If in demo mode and no session cookie, still let client-side router handle or require session
  if (!isDemo && !session && pathname.startsWith('/admin')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
