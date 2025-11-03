import { NextResponse } from 'next/server';
import { supabaseAnon } from '@/lib/supabaseAnon';
import { SIGNUP_EMAIL_COOKIE } from '@/lib/session';

const SECURE = process.env.NODE_ENV === 'production';

export async function POST(req: Request) {
  const { email, token } = await req.json();
  if (!email || !token) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

  const { error } = await supabaseAnon.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 401 });

  const res = NextResponse.json({ verified: true });
  res.cookies.set(SIGNUP_EMAIL_COOKIE, email, {
    httpOnly: true, sameSite: 'lax', secure: SECURE, path: '/', maxAge: 60 * 15
  });
  return res;
}
