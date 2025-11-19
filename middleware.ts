// app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SIGNUP_EMAIL_COOKIE, verifySession } from '@/lib/session';

const PUBLIC_FILES = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|json)$/i;
const PUBLIC_PATHS = new Set<string>(['/', '/favicon.ico']);
const PUBLIC_PREFIXES = ['/assets', '/images', '/fonts', '/_next'];
const PUBLIC_API = ['/api/ping', '/api/health'];
const AUTH_API_PREFIX = '/api/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Always-public: static & root & health
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_FILES.test(pathname) ||
    PUBLIC_API.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  // 2) Your auth endpoints are public
  if (pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next();
  }

  // 3) Allow /athletes/add if we either:
  //    - have a valid session, OR
  //    - have the signup email cookie (OTP flow)
  if (pathname.startsWith('/athletes/add')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value || null;
    const signupEmail = req.cookies.get(SIGNUP_EMAIL_COOKIE)?.value || null;

    if (token) {
      try {
        const sess = await verifySession(token);
        if (sess?.aid) return NextResponse.next();
      } catch {
        // fall through
      }
    }
    if (signupEmail) return NextResponse.next();

    const url = new URL('/', req.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // 4) Everything else requires a **valid** session (not just a cookie)
  const token = req.cookies.get(SESSION_COOKIE)?.value || null;
  if (!token) {
    const url = new URL('/', req.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  try {
    const sess = await verifySession(token);
    if (!sess?.aid) {
      // optional: clear a bad cookie
      const res = NextResponse.redirect(new URL('/', req.url));
      res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
      return res;
    }

    // optional: pass role downstream if you want
    const res = NextResponse.next();
    if (sess.role) res.headers.set('x-user-role', String(sess.role));
    return res;
  } catch {
    const res = NextResponse.redirect(new URL('/', req.url));
    res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
  }
}

export const config = {
  // Keep simple; we filter inside. This won’t block static due to early returns above.
  matcher: ['/((?!api/preview).*)'],
};
