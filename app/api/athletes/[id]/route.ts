export const runtime = 'nodejs';


import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  const id = pathname.split('/').pop()!;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess || sess.role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select(`
      id, email, is_coach,
      first_name, last_name, nickname, team_name,
      dob, phone, gender, height_cm, weight_kg, years_of_experience,
      notes, emergency_name, emergency_phone
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ athlete: data });
}

export async function PATCH(req: Request) {
  const { pathname } = new URL(req.url);
  const id = pathname.split('/').pop()!;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess || sess.role !== 'coach') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  // Επιτρέπουμε ΜΟΝΟ αυτά (όχι email/password)
  const allowed: any = {
    first_name: body.first_name ?? null,
    last_name: body.last_name ?? null,
    nickname: body.nickname ?? null,
    team_name: body.team_name ?? null,
    dob: body.dob ?? null,
    phone: body.phone ?? null,
    gender: body.gender ?? null,
    height_cm: body.height_cm ?? null,
    weight_kg: body.weight_kg ?? null,
    years_of_experience: body.years_of_experience ?? null,
    notes: body.notes ?? null,
    emergency_name: body.emergency_name ?? null,
    emergency_phone: body.emergency_phone ?? null,
    is_coach: typeof body.is_coach === 'boolean' ? body.is_coach : undefined,
  };

  // καθάρισε undefined keys
  Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .update(allowed)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
