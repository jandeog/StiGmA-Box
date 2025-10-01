// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const USER = process.env.BASIC_USER || '';
const PASS = process.env.BASIC_PASS || '';

export function middleware(req: NextRequest) {
  // Debug header: για να δούμε ότι τρέχει
  const res = NextResponse.next();
  res.headers.set('x-middleware', 'on');

  if (!USER || !PASS) {
    return res; // δεν μπλοκάρουμε αν λείπουν env
  }

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const [u, p] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    if (u === USER && p === PASS) return res;
  }
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="WOD Box"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
};
