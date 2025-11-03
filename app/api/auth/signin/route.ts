export const runtime = 'nodejs';


import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, signSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

const SECURE = process.env.NODE_ENV === 'production';

export async function POST(req: Request) {
  const { email, password, remember } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  const { data: athlete } = await supabaseAdmin
    .from('athletes')
    .select('id,email,password_hash,is_coach')
    .ilike('email', email)
    .maybeSingle();

  if (!athlete?.password_hash) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, athlete.password_hash);
  if (!ok) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });

  const role = athlete.is_coach ? 'coach' as const : 'athlete' as const;

  const jwt = await signSession({
    aid: athlete.id,
    email: athlete.email,
    role,
  });

  const maxAge = remember ? 60 * 60 * 24 * 30 : undefined;
  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true, sameSite: 'lax', secure: SECURE, path: '/',
    ...(maxAge ? { maxAge } : {}),
  });
  return res;
}
