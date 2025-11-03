export const runtime = 'nodejs';


import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess?.aid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select(`
      id, email, is_coach,
      first_name, last_name, nickname, team_name,
      dob, phone, gender, height_cm, weight_kg, years_of_experience,
      notes, emergency_name, emergency_phone
    `)
    .eq('id', sess.aid)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ me: data });
}
