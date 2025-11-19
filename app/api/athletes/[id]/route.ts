export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function asInt(v: any) {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ----------------------------- GET /athletes/:id ---------------------------- */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = String(params.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // session check (coach only for this endpoint)
  const token = cookies().get(SESSION_COOKIE)?.value || null;
  let sess = null;
  try {
    sess = await verifySession(token || undefined);
  } catch {
    sess = null;
  }
  if (!sess || sess.role !== 'coach') {
    const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
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

  if (error) {
    const res = NextResponse.json({ error: error.message }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  if (!data) {
    const res = NextResponse.json({ error: 'Not found' }, { status: 404 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const res = NextResponse.json({ athlete: data }, { status: 200 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

/* ---------------------------- PATCH /athletes/:id --------------------------- */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const id = String(params.id || '').trim();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  // session check (coach only)
  const token = cookies().get(SESSION_COOKIE)?.value || null;
  let sess = null;
  try {
    sess = await verifySession(token || undefined);
  } catch {
    sess = null;
  }
  if (!sess || sess.role !== 'coach') {
    const res = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // parse body safely
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Only these fields are allowed to be patched
  const allowed = new Set([
    'first_name','last_name','nickname','team_name',
    'dob','phone','gender',
    'height_cm','weight_kg','years_of_experience',
    'notes','emergency_name','emergency_phone',
    'is_coach','credits',
  ]);

  // Build a partial update object
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

  if (Object.keys(update).length === 0) {
    const res = NextResponse.json({ ok: true, id });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .update(update)
    .eq('id', id)
    .select('id, email, is_coach, credits')
    .maybeSingle();

  if (error) {
    const res = NextResponse.json({ error: error.message }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  if (!data) {
    const res = NextResponse.json({ error: 'Not found' }, { status: 404 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const res = NextResponse.json({ ok: true, id: data.id }, { status: 200 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
