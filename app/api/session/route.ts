import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/session';

export async function GET() {
  // ⏳ περιμένουμε πρώτα να πάρουμε τα cookies
  const cookieStore = await cookies();
  const token = cookieStore.get('SESSION_COOKIE')?.value;

  if (!token) {
    return NextResponse.json({ session: null });
  }

  const sessionPayload = await verifySession(token);
  return NextResponse.json({ session: sessionPayload });
}
