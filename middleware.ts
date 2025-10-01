// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const USER = process.env.BASIC_USER || '';
const PASS = process.env.BASIC_PASS || '';

export function middleware(req: NextRequest) {
  // Αν δεν έχουμε βάλει env vars, μην μπλοκάρεις την πρόσβαση
  if (!USER || !PASS) return NextResponse.next();

  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const [u, p] = Buffer.from(auth.split(' ')[1], 'base64').toString().split(':');
    if (u === USER && p === PASS) return NextResponse.next();
  }
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="WOD Box"' },
  });
}

export const config = {
  matcher: [
    // Προστάτευσε τα πάντα εκτός από static assets
    '/((?!_next/static|_next/image|favicon.ico|images/).*)',
  ],
};
