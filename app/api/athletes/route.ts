
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess?.aid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select(`
      id, first_name, last_name, nickname, team_name,
      dob, email, phone, is_coach,
      height_cm, weight_kg, years_of_experience,
      notes, emergency_name, emergency_phone,
      created_at, updated_at
    `)
    .order('is_coach', { ascending: false })
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

/**
 * Coach creates a brand-new athlete with email + password (+ optional profile fields)
 * Body:
 *  { email, password, first_name?, ... , is_coach? }
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess || sess.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'Password too short (≥6)' }, { status: 400 });
  }

  // prevent duplicate email
  const { data: existing, error: exErr } = await supabaseAdmin
    .from('athletes')
    .select('id')
    .ilike('email', email)
    .maybeSingle();
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  if (existing?.id) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const payload: any = {
    email,
    password_hash,
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
    is_coach: !!body.is_coach,
  };

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .insert(payload)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data?.id });
}
