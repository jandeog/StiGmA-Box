import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, SIGNUP_EMAIL_COOKIE, signSession, verifySession } from '@/lib/session';
import bcrypt from 'bcryptjs';

const SECURE = process.env.NODE_ENV === 'production';

export async function POST(req: Request) {
  const body = await req.json();
  const { password, remember, ...profile } = body || {};

  const cookieStore = await cookies();
  const signupEmailCookie = cookieStore.get(SIGNUP_EMAIL_COOKIE)?.value || '';

  // Ποιος είμαι (αν υπάρχει session)
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token); // μπορεί να είναι null σε πρώτη εγγραφή μετά το OTP

  const isCoachUser = sess?.role === 'coach';
  const emailFromSignup = String(signupEmailCookie || profile.email || '').trim().toLowerCase();

  // Αν έχουμε session => κάνουμε EDIT-SELF ΜΕ ΒΑΣΗ aid (ασφαλέστερο από email)
  // Αν δεν έχουμε session => πρώτη εγγραφή (με email από cookie/profile)
  let athleteId: string | null = null;

  if (sess?.aid) {
    athleteId = sess.aid;
  } else {
    // πρώτη εγγραφή: βρες αν υπάρχει ήδη row με αυτό το email
    const { data: existingByEmail, error: findErr } = await supabaseAdmin
      .from('athletes')
      .select('id')
      .ilike('email', emailFromSignup)
      .maybeSingle();
    if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });
    athleteId = existingByEmail?.id ?? null;
  }

  // Αν ΔΕΝ υπάρχει row και ΔΕΝ έχει password => error (πρώτη εγγραφή απαιτεί password)
  if (!athleteId && (!password || password.length < 6)) {
    return NextResponse.json({ error: 'Password too short' }, { status: 400 });
  }

  // Φτιάξε payload update/insert
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
  };

  // Επιτρέπουμε αλλαγή is_coach μόνο αν ο ΧΡΗΣΤΗΣ ΕΙΝΑΙ coach
  if (isCoachUser && typeof profile.is_coach === 'boolean') {
    payload.is_coach = profile.is_coach;
  }

  if (password && password.length >= 6) {
    payload.password_hash = await bcrypt.hash(password, 10);
  }

  let isInsert = false;

  if (athleteId) {
    // UPDATE by id (edit-self)
    const { error } = await supabaseAdmin.from('athletes').update(payload).eq('id', athleteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // ΠΡΩΤΗ ΕΓΓΡΑΦΗ (signup): insert με email
    const insertPayload = { ...payload, email: emailFromSignup };
    const { data, error } = await supabaseAdmin.from('athletes').insert(insertPayload).select('id').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    athleteId = data?.id ?? null;
    isInsert = true;
  }

  // Υπολογισμός ρόλου για το JWT από την τελική τιμή is_coach
  let finalIsCoach = false;
  if (athleteId) {
    const { data: row, error } = await supabaseAdmin.from('athletes').select('email,is_coach').eq('id', athleteId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    finalIsCoach = !!row?.is_coach;
  }

  const role = finalIsCoach ? 'coach' : 'athlete';
  const emailForJwt = emailFromSignup || sess?.email || '';

  const jwt = await signSession({ aid: athleteId!, email: emailForJwt, role });

  const res = NextResponse.json({ ok: true, role });
  res.cookies.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE,
    path: '/',
    ...(remember ? { maxAge: 60 * 60 * 24 * 30 } : {}),
  });
  // καθάρισε το signup email cookie αν υπήρχε
  res.cookies.set(SIGNUP_EMAIL_COOKIE, '', { path: '/', maxAge: 0 });

  return res;
}
