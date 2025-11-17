// app/api/scores/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function json(data: any, init?: number | ResponseInit) {
  if (typeof init === 'number') return NextResponse.json(data, { status: init });
  return NextResponse.json(data, init);
}

function badRequest(message: string) {
  return json({ error: message }, 400);
}

function unauthorized() {
  return json({ error: 'Not authenticated' }, 401);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  if (!date) {
    return badRequest('Missing "date" query parameter');
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('wod_scores')
    .select(
      `
        id,
        athlete_id,
        wod_date,
        part,
        rx_scaled,
        score,
        created_at,
        athlete:athlete_id (
          first_name,
          last_name,
          nickname,
          team_name
        )
      `,
    )
    .eq('wod_date', date)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('GET /api/scores error', error);
    return json({ error: 'Failed to load scores' }, 500);
  }

  return json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return unauthorized();

  const body = await req.json().catch(() => null);

  const date = (body?.date as string | undefined)?.trim();
  const athleteId = (body?.athleteId as string | undefined)?.trim();
  const strength =
    (body?.strength as { rxScaled?: string; value?: string } | null) ?? null;
  const main =
    (body?.main as { rxScaled?: string; value?: string } | null) ?? null;
  const classSlotId =
    (body?.classSlotId as string | null | undefined) ?? null;

  if (!date || !athleteId) {
    return badRequest('Missing date or athleteId');
  }

  // Athletes can only submit for themselves. Coaches can submit for anyone.
  if (session.role !== 'coach' && athleteId !== session.aid) {
    return json(
      { error: 'You can only submit scores for yourself.' },
      403,
    );
  }

  const rows: any[] = [];

  if (strength && strength.value?.trim()) {
    rows.push({
      athlete_id: athleteId,
      wod_date: date,
      part: 'strength',
      rx_scaled: strength.rxScaled === 'Scaled' ? 'Scaled' : 'RX',
      score: strength.value.trim(),
      class_slot_id: classSlotId,
    });
  }

  if (main && main.value?.trim()) {
    rows.push({
      athlete_id: athleteId,
      wod_date: date,
      part: 'main',
      rx_scaled: main.rxScaled === 'Scaled' ? 'Scaled' : 'RX',
      score: main.value.trim(),
      class_slot_id: classSlotId,
    });
  }

  if (!rows.length) {
    return badRequest('Nothing to save.');
  }

  // Prevent double-submit per athlete/date/part
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('wod_scores')
    .select('id, part')
    .eq('wod_date', date)
    .eq('athlete_id', athleteId);

  if (existingErr) {
    console.error('check existing wod_scores failed', existingErr);
    return json({ error: 'Failed to save scores' }, 500);
  }

  if (existing?.some((r: any) => r.part === 'strength') && rows.some(r => r.part === 'strength')) {
    return json(
      { error: 'Strength score already submitted for this athlete and day.' },
      409,
    );
  }

  if (existing?.some((r: any) => r.part === 'main') && rows.some(r => r.part === 'main')) {
    return json(
      { error: 'Main WOD score already submitted for this athlete and day.' },
      409,
    );
  }

  const { data, error: insertErr } = await supabaseAdmin
    .from('wod_scores')
    .insert(rows)
    .select('id, part');

  if (insertErr) {
    console.error('insert wod_scores failed', insertErr);
    return json({ error: 'Failed to save scores' }, 500);
  }

  return json({ ok: true, inserted: data ?? [] });
}
