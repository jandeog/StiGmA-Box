export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;

  const sess = await verifySession(token || undefined).catch(() => null);
  if (!sess?.aid) {
    const res = NextResponse.json({ me: null }, { status: 200 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select(`
      id, email,
      first_name, last_name, nickname, team_name,
      dob, phone, gender,
      height_cm, weight_kg, years_of_experience,
      notes, credits, is_coach,
      terms_version, terms_accepted_at,
      emergency_name, emergency_phone
    `)
    .eq('id', sess.aid)
    .maybeSingle();

  if (error) {
    const res = NextResponse.json({ me: null, error: error.message }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const res = NextResponse.json({ me: data }, { status: 200 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
