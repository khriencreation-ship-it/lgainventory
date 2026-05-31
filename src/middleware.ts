import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;

  const user = sessionToken ? await verifyJWT(sessionToken) : null;

  // Protect /super-admin routes
  if (pathname.startsWith('/super-admin')) {
    if (!user) {
      const url = new URL('/superadmin', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    if (user.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/superadmin', request.url));
    }
  }

  // Protect /dashboard/officer routes
  if (pathname.startsWith('/dashboard/officer')) {
    if (!user) {
      const url = new URL('/', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    if (user.role !== 'lg_account_officer' && user.role !== 'lg_officer') {
      if (user.role === 'treasurer' || user.role === 'lg_treasurer') {
        return NextResponse.redirect(new URL('/dashboard/treasurer', request.url));
      }
      if (user.role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      }
      if (user.role === 'lg_chairman' || user.role === 'lg_admin') {
        return NextResponse.redirect(new URL('/dashboard/chairman', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Protect /dashboard/chairman routes
  if (pathname.startsWith('/dashboard/chairman')) {
    if (!user) {
      const url = new URL('/', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    if (user.role !== 'lg_chairman' && user.role !== 'lg_admin') {
      if (user.role === 'treasurer' || user.role === 'lg_treasurer') {
        return NextResponse.redirect(new URL('/dashboard/treasurer', request.url));
      }
      if (user.role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      }
      if (user.role === 'lg_account_officer' || user.role === 'lg_officer') {
        return NextResponse.redirect(new URL('/dashboard/officer', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Protect /dashboard/treasurer routes
  if (pathname.startsWith('/dashboard/treasurer')) {
    if (!user) {
      const url = new URL('/', request.url);
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    if (user.role !== 'treasurer' && user.role !== 'lg_treasurer') {
      if (user.role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      }
      if (user.role === 'lg_chairman' || user.role === 'lg_admin') {
        return NextResponse.redirect(new URL('/dashboard/chairman', request.url));
      }
      if (user.role === 'lg_account_officer' || user.role === 'lg_officer') {
        return NextResponse.redirect(new URL('/dashboard/officer', request.url));
      }
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Protect /api/super-admin API routes
  if (pathname.startsWith('/api/super-admin')) {
    if (!user || user.role !== 'super_admin') {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized. Super Admin access required.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // Redirect authenticated users away from /superadmin login page
  if (pathname === '/superadmin') {
    if (user) {
      if (user.role === 'super_admin') {
        return NextResponse.redirect(new URL('/super-admin', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/super-admin/:path*', 
    '/api/super-admin/:path*', 
    '/superadmin',
    '/dashboard/officer/:path*',
    '/dashboard/chairman/:path*',
    '/dashboard/treasurer/:path*'
  ],
};
