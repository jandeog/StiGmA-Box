export const runtime = 'nodejs';


import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SIGNUP_EMAIL_COOKIE } from '@/lib/session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set(SIGNUP_EMAIL_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
