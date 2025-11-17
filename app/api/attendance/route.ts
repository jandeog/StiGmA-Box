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

  const { data } = await supabaseAdmin
    .from('athletes')
    .select('is_coach')
    .eq('id', sess.aid)
    .maybeSingle();

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

  // slot meta
  const { data: slot, error: se } = await supabaseAdmin
    .from('schedule_slots')
    .select('id,date,time,title,capacity_main,capacity_wait')
    .eq('id', slotId)
    .maybeSingle();
  if (se) return json({ error: se.message }, 500);
  if (!slot) return json({ error: 'Slot not found' }, 404);

  // stats
  const { data: counts, error: ce } = await supabaseAdmin
    .from('schedule_participants')
    .select('list_type', { count: 'exact' })
    .eq('slot_id', slotId);
  if (ce) return json({ error: ce.message }, 500);
  const booked_main = (counts ?? []).filter((r) => r.list_type === 'main').length;
  const booked_wait = (counts ?? []).filter((r) => r.list_type === 'wait').length;

  // roster (qualify list_type and include attendance)
  const { data: rosterRows, error: re } = await supabaseAdmin
    .from('schedule_participants')
    .select(
      `athlete_id, list_type,
       athletes!inner(first_name,last_name,email),
       attendance:attendance!left(attended, attended_at)`
    )
    .eq('slot_id', slotId);
  if (re) return json({ error: re.message }, 500);

  const roster = (rosterRows ?? []).map((r: any) => ({
    athlete_id: r.athlete_id,
    first_name: r.athletes?.first_name ?? '',
    last_name: r.athletes?.last_name ?? '',
    email: r.athletes?.email ?? '',
    list_type: r.list_type as 'main' | 'wait',
    attended: !!r.attendance?.[0]?.attended,
    attended_at: r.attendance?.[0]?.attended_at ?? null,
  }));

  return json({
    slot,
    stats: { booked_main, booked_wait },
    roster,
  });
}

/** POST /api/attendance  { action, ... }  */
export async function POST(req: NextRequest) {
  const auth = await requireCoach();
  if (auth.error) return auth.error;

  const body = await req.json();
  const action = body?.action as 'search' | 'add' | 'toggle';

  if (action === 'search') {
    const slotId = body?.slotId as string;
    const q = (body?.q || '').trim();
    if (!slotId || !q) return json({ results: [] });

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
    if (!slotId || !athleteId) return json({ error: 'Missing slotId/athleteId' }, 400);

    // Move/add participant via RPC (resolves the "list_type is ambiguous")
    // Choose list_type = 'main' by default; you can change to 'wait' if needed.
    const { data: moved, error: rpcErr } = await supabaseAdmin.rpc('add_or_move_participant', {
      p_slot: slotId,
      p_athlete: athleteId,
      p_list: 'main',
    });
    if (rpcErr) return json({ error: rpcErr.message }, 500);

    // Mark attendance true
    const { error: aerr } = await supabaseAdmin
      .from('attendance')
      .upsert(
        { slot_id: slotId, athlete_id: athleteId, attended: true, attended_at: new Date().toISOString() },
        { onConflict: 'slot_id,athlete_id' }
      );
    if (aerr) return json({ error: aerr.message }, 500);

    // Deduct 1 credit if possible (coach override: allow going negative? keep >= 0)
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

    // Upsert attendance
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

    // Adjust credits: present => -1 if not already deducted, absent => +1 (refund) if previously deducted.
    // Simple approach: if attended=true, ensure at least one credit was removed; if attended=false, add one back.
    // (You can refine this with an attendance audit table later.)
    if (attended) {
      const { data: ath } = await supabaseAdmin
        .from('athletes')
        .select('credits')
        .eq('id', athleteId)
        .maybeSingle();
      const newCredits = Math.max(0, (ath?.credits ?? 0) - 1);
      const { error: uerr } = await supabaseAdmin.from('athletes').update({ credits: newCredits }).eq('id', athleteId);
      if (uerr) return json({ error: uerr.message }, 500);
    } else {
      const { data: ath } = await supabaseAdmin
        .from('athletes')
        .select('credits')
        .eq('id', athleteId)
        .maybeSingle();
      const newCredits = (ath?.credits ?? 0) + 1;
      const { error: uerr } = await supabaseAdmin.from('athletes').update({ credits: newCredits }).eq('id', athleteId);
      if (uerr) return json({ error: uerr.message }, 500);
    }

    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
}
