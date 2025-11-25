// app/api/athletes/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)));

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // both roles can read list
  let query = supabaseAdmin
    .from('athletes')
    .select(
      `
      id,
      email,
      first_name,
      last_name,
      nickname,
      team_name,
      phone,
      credits,
      is_coach,
      created_at,
      updated_at,
      emergency_name,
      emergency_phone,
      last_credits_update
    `
    );

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      [
        `email.ilike.${like}`,
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `nickname.ilike.${like}`,
        `team_name.ilike.${like}`,
      ].join(',')
    );
  }

  const { data, error } = await query
    .order('is_coach', { ascending: false })
    .order('last_name', { ascending: true, nullsFirst: true })
    .order('first_name', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/* ---------------------------- POST /athletes ---------------------------- */
// Coach creates a brand-new athlete (using custom bcrypt auth)
export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;
  const sess = await verifySession(token || undefined).catch(() => null);

  // Only coaches can create new athletes
  if (!sess || sess.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    email,
    password,
    first_name,
    last_name,
    nickname,
    team_name,
    dob,
    phone,
    gender,
    height_cm,
    weight_kg,
    years_of_experience,
    notes,
    emergency_name,
    emergency_phone,
    is_coach,
    credits,
  } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
  }

  // 1) Hash password (CUSTOM AUTH)
  const password_hash = await bcrypt.hash(password, 10);

  // 2) Determine initial credits + renewal date
  const initialCredits =
    typeof credits === 'number' && Number.isFinite(credits) ? credits : 0;

  const lastCreditsUpdate =
    initialCredits > 0 ? new Date().toISOString() : null;

  // 3) Insert new athlete row
  const { data, error } = await supabaseAdmin
    .from('athletes')
    .insert({
      email,
      password_hash,
      first_name: first_name || null,
      last_name: last_name || null,
      nickname: nickname || null,
      team_name: team_name || null,
      dob: dob || null,
      phone: phone || null,
      gender: gender || null,
      height_cm: height_cm ?? null,
      weight_kg: weight_kg ?? null,
      years_of_experience: years_of_experience ?? null,
      notes: notes || null,
      emergency_name: emergency_name || null,
      emergency_phone: emergency_phone || null,
      credits: initialCredits,
      last_credits_update: lastCreditsUpdate,
      is_coach: !!is_coach,
    })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, athlete: data }, { status: 200 });
}
