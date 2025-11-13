// app/api/attendance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function json(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, no-cache, must-revalidate',
      pragma: 'no-cache',
    },
  });
}

type CoachAuth =
  | { err: null; me: { id: string; is_coach: boolean } }
  | { err: string; me: null };

async function requireCoach(req: NextRequest): Promise<CoachAuth> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess?.aid) return { err: 'Unauthorized', me: null };

  const { data: me, error } = await supabaseAdmin
    .from('athletes')
    .select('id, is_coach')
    .eq('id', sess.aid)
    .maybeSingle();

  if (error) return { err: error.message, me: null };
  if (!me?.is_coach) return { err: 'Forbidden', me: null };
  return { err: null, me: { id: me.id, is_coach: true } };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireCoach(req);
    if (auth.err) return json({ error: auth.err }, auth.err === 'Forbidden' ? 403 : 401);

    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get('slotId');
    if (!slotId) return json({ error: 'Missing slotId' }, 400);

    // Slot meta
    const { data: slot, error: sErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('id, date, time, title, capacity_main, capacity_wait')
      .eq('id', slotId)
      .maybeSingle();
    if (sErr) return json({ error: sErr.message }, 500);
    if (!slot) return json({ error: 'Slot not found' }, 404);

    // Roster
    const { data: roster, error: rErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('athlete_id, list_type, attended, attended_at, athletes!inner(first_name, last_name, email)')
      .eq('slot_id', slotId)
      .order('list_type', { ascending: true }); // main first
    if (rErr) return json({ error: rErr.message }, 500);

    const booked_main = roster?.filter(r => r.list_type === 'main').length ?? 0;
    const booked_wait = roster?.filter(r => r.list_type === 'wait').length ?? 0;

    return json({
      slot,
      stats: { booked_main, booked_wait },
      roster: (roster ?? []).map((r: any) => ({
        athlete_id: r.athlete_id,
        list_type: r.list_type,
        attended: !!r.attended,
        attended_at: r.attended_at,
        first_name: r.athletes?.first_name ?? '',
        last_name: r.athletes?.last_name ?? '',
        email: r.athletes?.email ?? '',
      })),
    });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Failed' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCoach(req);
    if (auth.err) return json({ error: auth.err }, auth.err === 'Forbidden' ? 403 : 401);

    const body = await req.json();
    const action = body?.action as 'toggle' | 'add' | 'search';
    if (!action) return json({ error: 'Missing action' }, 400);

   if (action === 'toggle') {
  const { slotId, athleteId, attended } = body || {};
  if (!slotId || !athleteId || typeof attended !== 'boolean') {
    return json({ error: 'Missing slotId/athleteId/attended' }, 400);
  }

  // Fetch participant (we need list_type + refund guard)
  const { data: part, error: pErr } = await supabaseAdmin
    .from('schedule_participants')
    .select('slot_id, athlete_id, list_type, attended, refund_issued_at')
    .eq('slot_id', slotId)
    .eq('athlete_id', athleteId)
    .maybeSingle();
  if (pErr) return json({ error: pErr.message }, 500);
  if (!part) return json({ error: 'Not participant' }, 404);

  if (attended) {
    // Mark attended (idempotent)
    const { error: up1 } = await supabaseAdmin
      .from('schedule_participants')
      .update({ attended: true, attended_at: new Date().toISOString() })
      .eq('slot_id', slotId)
      .eq('athlete_id', athleteId);
    if (up1) return json({ error: up1.message }, 500);

    // Ensure attendance row exists
    const { error: insAtt } = await supabaseAdmin
      .from('attendance')
      .upsert({ slot_id: slotId, athlete_id: athleteId, method: 'coach' }, { onConflict: 'slot_id,athlete_id' });
    if (insAtt) return json({ error: insAtt.message }, 500);

    return json({ ok: true, result: { status: 'attended' } });
  } else {
    // Uncheck: mark not attended
    const { error: up2 } = await supabaseAdmin
      .from('schedule_participants')
      .update({ attended: false })
      .eq('slot_id', slotId)
      .eq('athlete_id', athleteId);
    if (up2) return json({ error: up2.message }, 500);

    // Remove attendance row (optional)
    const { error: delAtt } = await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('slot_id', slotId)
      .eq('athlete_id', athleteId);
    if (delAtt) return json({ error: delAtt.message }, 500);

    // Refund once if it was MAIN and not refunded before
    if (part.list_type === 'main' && !part.refund_issued_at) {
      const { error: credErr } = await supabaseAdmin
        .from('athletes')
        .update({ credits: (undefined as any) }) // placeholder to satisfy types
        .eq('id', athleteId);
      // Do the increment with a lightweight RPC or raw SQL; simplest: one-off RPC you already have:
      const { error: refErr } = await supabaseAdmin.rpc('refund_credit', { p_athlete_id: athleteId });
      if (refErr) return json({ error: refErr.message }, 500);

      const { error: markRefund } = await supabaseAdmin
        .from('schedule_participants')
        .update({ refund_issued_at: new Date().toISOString() })
        .eq('slot_id', slotId)
        .eq('athlete_id', athleteId);
      if (markRefund) return json({ error: markRefund.message }, 500);

      return json({ ok: true, result: { status: 'refunded' } });
    }

    return json({ ok: true, result: { status: 'unchecked' } });
  }
}


    if (action === 'add') {
      const { slotId, athleteId } = body || {};
      if (!slotId || !athleteId) {
        return json({ error: 'Missing slotId/athleteId' }, 400);
      }
      const { data, error } = await supabaseAdmin.rpc('add_walkin', {
        p_slot_id: slotId,
        p_athlete_id: athleteId,
        p_method: 'coach',
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, result: data?.[0] ?? null });
    }

    if (action === 'search') {
      const { slotId, q } = body || {};
      if (!slotId || typeof q !== 'string' || q.trim().length === 0) {
        return json({ error: 'Missing slotId/q' }, 400);
      }

      // Exclude already on the slot
      const { data: parts } = await supabaseAdmin
        .from('schedule_participants')
        .select('athlete_id')
        .eq('slot_id', slotId);
      const exclude = new Set((parts ?? []).map(p => p.athlete_id));

      const query = q.trim();
      const { data: found, error: fErr } = await supabaseAdmin
        .from('athletes')
        .select('id, first_name, last_name, email, credits')
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      if (fErr) return json({ error: fErr.message }, 500);

      return json({
        ok: true,
        results: (found ?? [])
          .filter(a => !exclude.has(a.id))
          .map(a => ({
            id: a.id,
            first_name: a.first_name,
            last_name: a.last_name,
            email: a.email,
            credits: a.credits,
          })),
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? 'Failed' }, 500);
  }
}
