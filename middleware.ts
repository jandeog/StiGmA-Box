// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SIGNUP_EMAIL_COOKIE, verifySession } from './lib/session';

const AUTH_API_PREFIX = '/api/auth';

// Always-public stuff (static & root)
const PUBLIC_PATHS = new Set<string>(['/','/favicon.ico']);
const PUBLIC_DIR_PREFIXES = ['/assets', '/images', '/fonts', '/_next'];
const PUBLIC_FILE = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|json)$/i;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) Allow static/public assets & root
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_DIR_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 2) Allow auth API
  if (pathname.startsWith(AUTH_API_PREFIX)) {
    return NextResponse.next();
  }

  // 3) OTP → /athletes/add: allow if we have session OR signup-email cookie
  if (pathname.startsWith('/athletes/add')) {
    const hasSession = req.cookies.get(SESSION_COOKIE)?.value;
    const signupEmail = req.cookies.get(SIGNUP_EMAIL_COOKIE)?.value;
    if (hasSession || signupEmail) return NextResponse.next();
    return NextResponse.redirect(new URL('/', req.url));
  }

  // 4) Coach-only gate for /wod
  if (pathname.startsWith('/wod')) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return NextResponse.redirect(new URL('/', req.url));
    const sess = await verifySession(token);
    if (!sess || sess.role !== 'coach') {
      // non-coach: send to schedule (or '/')
      return NextResponse.redirect(new URL('/schedule', req.url));
    }
    return NextResponse.next();
  }

  // 5) Everything else requires a valid session
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL('/', req.url));

  return NextResponse.next();
}

export const config = {
  // generic matcher; filtering is done inside the middleware
  matcher: ['/((?!api/preview).*)'],
};
