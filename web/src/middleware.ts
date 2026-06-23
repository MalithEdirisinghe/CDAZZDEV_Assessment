import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/request';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get tokens from cookies
  const hasAccessToken = request.cookies.has('access_token');
  const hasRefreshToken = request.cookies.has('refresh_token');
  const isAuthenticated = hasAccessToken || hasRefreshToken;

  // Paths that require authentication
  const isProtectedRoute = pathname.startsWith('/dashboard');
  
  // Auth paths (login, register)
  const isAuthRoute = pathname === '/login' || pathname === '/register';

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Keep track of redirect path
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Run middleware on dashboard, login, and register pages
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};
