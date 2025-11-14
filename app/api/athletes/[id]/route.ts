export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function asInt(v: any) {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const { pathname } = new URL(req.url);
  const id = pathname.split('/').pop()!;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess || sess.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select(`
      id, email, is_coach,
      first_name, last_name, nickname, team_name,
      dob, phone, gender, height_cm, weight_kg, years_of_experience,
      notes, emergency_name, emergency_phone,
      credits
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
  if (!sess || sess.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  // Only these fields are allowed to be patched
  const allowed = new Set([
    'first_name','last_name','nickname','team_name',
    'dob','phone','gender',
    'height_cm','weight_kg','years_of_experience',
    'notes','emergency_name','emergency_phone',
    'is_coach','credits',
  ]);

  // Build a partial update object: include a key ONLY if it exists in the JSON
  const update: Record<string, any> = {};
  for (const k in body) {
    if (!allowed.has(k)) continue;
    const v = body[k];

    switch (k) {
      case 'is_coach':
        if (typeof v === 'boolean') update.is_coach = v;
        break;

      case 'height_cm':
      case 'weight_kg':
      case 'years_of_experience': {
        const n = asInt(v);
        update[k] = n; // allow null to clear
        break;
      }

      case 'credits': {
        const n = asInt(v);
        if (n != null) update.credits = Math.max(0, Math.floor(n));
        break;
      }

      default:
        // strings: allow explicit null, treat '' as null, otherwise keep string
        update[k] = v === '' ? null : (v ?? null);
        break;
    }
  }

  // If nothing to update, return OK (prevents accidental wipes)
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, id });
  }

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .update(update)
    .eq('id', id)
    .select('id, email, is_coach, credits')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
