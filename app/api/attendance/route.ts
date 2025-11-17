// app/api/attendance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function json(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function requireCoach() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess?.aid) return { error: json({ error: 'Unauthorized' }, 401) };

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select('is_coach')
    .eq('id', sess.aid)
    .maybeSingle();

  if (error) return { error: json({ error: error.message }, 500) };
  if (!data?.is_coach) return { error: json({ error: 'Forbidden' }, 403) };

  return { sess };
}

/** GET /api/attendance?slotId=... -> { slot, stats, roster } */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slotId = searchParams.get('slotId');

  const auth = await requireCoach();
  if (auth.error) return auth.error;
  if (!slotId) return json({ error: 'Missing slotId' }, 400);

  // Slot meta
  const { data: slot, error: se } = await supabaseAdmin
    .from('schedule_slots')
    .select('id,date,time,title,capacity_main,capacity_wait')
    .eq('id', slotId)
    .maybeSingle();
  if (se) return json({ error: se.message }, 500);
  if (!slot) return json({ error: 'Slot not found' }, 404);

  // Counts
  const { data: countRows, error: ce } = await supabaseAdmin
    .from('schedule_participants')
    .select('list_type', { count: 'exact' })
    .eq('slot_id', slotId);
  if (ce) return json({ error: ce.message }, 500);
  const booked_main = (countRows ?? []).filter(r => r.list_type === 'main').length;
  const booked_wait  = (countRows ?? []).filter(r => r.list_type === 'wait').length;

  // Roster: participants (+ athlete data)
  const { data: partRows, error: re1 } = await supabaseAdmin
    .from('schedule_participants')
    .select(`athlete_id, list_type,
             athletes!inner(first_name,last_name,email)`)
    .eq('slot_id', slotId);
  if (re1) return json({ error: re1.message }, 500);

  // Attendance: fetched separately (no FK inference required)
  const { data: attRows, error: re2 } = await supabaseAdmin
    .from('attendance')
    .select('athlete_id, attended, attended_at')
    .eq('slot_id', slotId);
  if (re2) return json({ error: re2.message }, 500);

  // Merge participants with attendance
  const attByAthlete = new Map(
    (attRows ?? []).map(r => [r.athlete_id, { attended: !!r.attended, attended_at: r.attended_at }])
  );

  const roster = (partRows ?? []).map((r: any) => {
    const a = attByAthlete.get(r.athlete_id);
    return {
      athlete_id: r.athlete_id,
      first_name: r.athletes?.first_name ?? '',
      last_name:  r.athletes?.last_name  ?? '',
      email:      r.athletes?.email      ?? '',
      list_type:  r.list_type as 'main' | 'wait',
      attended:   a?.attended ?? false,
      attended_at:a?.attended_at ?? null,
    };
  });

  return json({
    slot,
    stats: { booked_main, booked_wait },
    roster,
  });
}

/** POST /api/attendance  { action, ... } */
export async function POST(req: NextRequest) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;

  const body = await req.json();
  const action = body?.action as 'search' | 'add' | 'toggle';

  if (action === 'search') {
    const q = (body?.q || '').trim();
    if (!q) return json({ results: [] });

    const { data, error } = await supabaseAdmin
      .from('athletes')
      .select('id, first_name, last_name, email, credits')
      .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
      .order('last_name', { ascending: true })
      .limit(20);

    if (error) return json({ error: error.message }, 500);
    return json({ results: data ?? [] });
  }

  if (action === 'add') {
    const slotId = body?.slotId as string;
    const athleteId = body?.athleteId as string;
    const listType: 'main' | 'wait' = body?.listType ?? 'main';
    if (!slotId || !athleteId) return json({ error: 'Missing slotId/athleteId' }, 400);

    // Move/add participant via RPC (fixes list_type ambiguity)
    const { error: rpcErr } = await supabaseAdmin.rpc('add_or_move_participant', {
      p_slot: slotId,
      p_athlete: athleteId,
      p_list: listType,
    });
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    // Mark attendance as present (walk-in)
    const { error: aerr } = await supabaseAdmin
      .from('attendance')
      .upsert(
        { slot_id: slotId, athlete_id: athleteId, attended: true, attended_at: new Date().toISOString() },
        { onConflict: 'slot_id,athlete_id' }
      );
    if (aerr) return json({ error: aerr.message }, 500);

    // Deduct 1 credit (simple model)
    const { data: ath } = await supabaseAdmin
      .from('athletes')
      .select('credits')
      .eq('id', athleteId)
      .maybeSingle();
    const newCredits = Math.max(0, (ath?.credits ?? 0) - 1);
    const { error: cerr } = await supabaseAdmin
      .from('athletes')
      .update({ credits: newCredits })
      .eq('id', athleteId);
    if (cerr) return json({ error: cerr.message }, 500);

    return json({ ok: true });
  }

  if (action === 'toggle') {
    const slotId = body?.slotId as string;
    const athleteId = body?.athleteId as string;
    const attended = !!body?.attended;
    if (!slotId || !athleteId) return json({ error: 'Missing slotId/athleteId' }, 400);

    // Upsert attendance row
    const { error: aerr } = await supabaseAdmin
      .from('attendance')
      .upsert(
        {
          slot_id: slotId,
          athlete_id: athleteId,
          attended,
          attended_at: attended ? new Date().toISOString() : null,
        },
        { onConflict: 'slot_id,athlete_id' }
      );
    if (aerr) return json({ error: aerr.message }, 500);

    // Adjust credits (basic logic)
    const { data: ath } = await supabaseAdmin
      .from('athletes')
      .select('credits')
      .eq('id', athleteId)
      .maybeSingle();

    const cur = ath?.credits ?? 0;
    const next = attended ? Math.max(0, cur - 1) : cur + 1;

    const { error: uerr } = await supabaseAdmin
      .from('athletes')
      .update({ credits: next })
      .eq('id', athleteId);
    if (uerr) return json({ error: uerr.message }, 500);

    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
}
