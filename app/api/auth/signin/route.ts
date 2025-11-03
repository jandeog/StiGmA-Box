export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, signSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const body = await req.json();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const acceptRules = !!body?.acceptRules;

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  // Load exactly the fields your schema defines
  const { data: row, error: findErr } = await supabaseAdmin
    .from('athletes')
    .select('id, email, password_hash, is_coach, terms_version, terms_accepted_at')
    .ilike('email', email)
    .maybeSingle();

  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
  if (!row?.id || !row.password_hash) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const alreadyAccepted = !!row.terms_accepted_at && (row.terms_version ?? 0) >= 1;
  if (!alreadyAccepted && !acceptRules) {
    return NextResponse.json({ error: 'You must accept the Gym Rules to sign in.' }, { status: 400 });
  }

  if (!alreadyAccepted && acceptRules) {
    const { error: updErr } = await supabaseAdmin
      .from('athletes')
      .update({ terms_version: 1, terms_accepted_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const role = row.is_coach ? 'coach' : 'athlete';
  const jwt = await signSession({ aid: row.id, email: row.email, role });

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  return res;
}
