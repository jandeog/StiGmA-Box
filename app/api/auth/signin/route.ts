export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, SIGNUP_EMAIL_COOKIE, signSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const acceptRules = !!body?.acceptRules;

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    // 1) Fetch the athlete
    const { data: row, error: findErr } = await supabaseAdmin
      .from('athletes')
      .select('id, email, password_hash, is_coach, terms_version, terms_accepted_at')
      .ilike('email', email)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json({ error: findErr.message }, { status: 500 });
    }
    if (!row?.id || !row.password_hash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 2) Compare password
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // 3) Enforce rules acceptance once
    const alreadyAccepted = !!row.terms_accepted_at && (row.terms_version ?? 0) >= 1;
    if (!alreadyAccepted && !acceptRules) {
      return NextResponse.json({ error: 'You must accept the Gym Rules to sign in.' }, { status: 400 });
    }
    if (!alreadyAccepted && acceptRules) {
      const { error: updErr } = await supabaseAdmin
        .from('athletes')
        .update({
          terms_version: 1,
          terms_accepted_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    // 4) Mint session
    const role = row.is_coach ? 'coach' : 'athlete';
    const jwt = await signSession({ aid: row.id, email: row.email, role });

    // 5) Send cookies + response
    const res = NextResponse.json({ ok: true, role });

    // main session cookie (HttpOnly)
    res.cookies.set(SESSION_COOKIE, jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    // cleanup: if user came from OTP/signup, kill that cookie so it can't interfere
    res.cookies.set(SIGNUP_EMAIL_COOKIE, '', { path: '/', maxAge: 0 });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Internal error' },
      { status: 500 }
    );
  }
}
