export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, SIGNUP_EMAIL_COOKIE, signSession, verifySession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const body = await req.json();
  const { password, ...profile } = body || {};
  const acceptRules = !!profile.acceptRules;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  const signupEmailCookie = cookieStore.get(SIGNUP_EMAIL_COOKIE)?.value || '';

  const emailFromSignup = String(signupEmailCookie || profile.email || '').trim().toLowerCase();

  // Resolve insert vs edit-self
  let athleteId: string | null = sess?.aid ?? null;
  if (!athleteId && emailFromSignup) {
    const { data, error } = await supabaseAdmin
      .from('athletes')
      .select('id')
      .ilike('email', emailFromSignup)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    athleteId = data?.id ?? null;
  }
  const isNewSignup = !athleteId;
const canEditCredits = sess?.role === 'coach'; // only coaches may set credits

  // For first signup acceptance is mandatory
  if (isNewSignup && !acceptRules) {
    return NextResponse.json({ error: 'You must accept the Gym Rules to complete signup.' }, { status: 400 });
  }

  // Build payload using your schema’s fields
  const payload: any = {
    first_name: profile.first_name ?? null,
    last_name: profile.last_name ?? null,
    nickname: profile.nickname ?? null,
    team_name: profile.team_name ?? null,
    dob: profile.dob ?? null,
    phone: profile.phone ?? null,
    gender: profile.gender ?? null,
    height_cm: profile.height_cm ?? null,
    weight_kg: profile.weight_kg ?? null,
    years_of_experience: profile.years_of_experience ?? null,
    notes: profile.notes ?? null,
    emergency_name: profile.emergency_name ?? null,
    emergency_phone: profile.emergency_phone ?? null,
    // is_coach handled elsewhere (coach can change via dedicated endpoints)
  };
if (canEditCredits && typeof profile.credits === 'number') {
  payload.credits = Math.max(0, Math.floor(profile.credits));
  }

  if (password && password.length >= 6) {
    payload.password_hash = await bcrypt.hash(password, 10);
  }

  if (isNewSignup) {
    // INSERT with acceptance values set
    const insertPayload: any = {
      ...payload,
      email: emailFromSignup,
      terms_version: 1,
      terms_accepted_at: acceptRules ? new Date().toISOString() : null,
    };
     // if a logged-in coach is creating their profile via this route, keep credits
    if (!(canEditCredits && typeof profile.credits === 'number')) {
      // ensure credits defaults to 0 on fresh signups
      insertPayload.credits = 0;
    }
    const { data, error } = await supabaseAdmin
      .from('athletes')
      .insert(insertPayload)
      .select('id, email, is_coach')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    athleteId = data?.id ?? null;
  } else {
    // EDIT-SELF: allow recording acceptance if provided now
    if (acceptRules) {
      payload.terms_version = 1;
      payload.terms_accepted_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from('athletes').update(payload).eq('id', athleteId!);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Read role to mint JWT
  const { data: finalRow, error: readErr } = await supabaseAdmin
    .from('athletes')
    .select('email, is_coach')
    .eq('id', athleteId!)
    .maybeSingle();
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  const role = finalRow?.is_coach ? 'coach' : 'athlete';
  const jwt = await signSession({ aid: athleteId!, email: finalRow?.email || emailFromSignup, role });

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
  // Clear the signup email cookie
  res.cookies.set(SIGNUP_EMAIL_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
