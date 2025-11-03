export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess?.aid) return NextResponse.json({ me: null });

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select('id, email, phone, dob, notes, is_coach, first_name, gender, last_name, nickname, team_name, credits, height_cm, weight_kg, years_of_experience, terms_version, terms_accepted_at')
    .eq('id', sess.aid)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ me: data });
}
