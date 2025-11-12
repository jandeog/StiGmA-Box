import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

/**
 * Flush future schedule_slots that correspond to an updated template scope,
 * refunding credits and cancelling all bookings for those slots.
 *
 * Body:
 * {
 *   mode: 'all_weekdays' | 'weekday' | 'dates',
 *   weekday?: 0|1|2|3|4|5|6,          // required when mode==='weekday'
 *   dates?: string[]                   // 'YYYY-MM-DD' (required when mode==='dates')
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { mode, weekday, dates } = await req.json();

    // Auth: only a coach can do this
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value; // 'sbx_session'
    const sess = await verifySession(token);
    if (!sess?.aid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // verify coach role from DB (not just the token)
    const { data: me, error: meErr } = await supabaseAdmin
      .from('athletes')
      .select('id, is_coach')
      .eq('id', sess.aid)
      .maybeSingle();
    if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });
    if (!me?.is_coach) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Build the set of slot IDs to flush (today and future only)
    let ids: string[] = [];

    if (mode === 'all_weekdays') {
      const { data, error } = await supabaseAdmin
        .from('schedule_slots')
        .select('id')
        .gte('date', new Date().toISOString().slice(0, 10));
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      ids = (data ?? []).map(r => r.id);
    } else if (mode === 'weekday') {
      if (typeof weekday !== 'number') {
        return NextResponse.json({ error: 'weekday is required (0..6)' }, { status: 400 });
      }
      // Postgres extract dow: Sunday=0..Saturday=6
      const { data, error } = await supabaseAdmin
        .rpc('get_future_slots_by_weekday', { p_weekday: weekday, p_from_date: new Date().toISOString().slice(0, 10) });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      ids = (data ?? []).map((r: any) => r.id);
    } else if (mode === 'dates') {
      if (!Array.isArray(dates) || dates.length === 0) {
        return NextResponse.json({ error: 'dates[] is required' }, { status: 400 });
      }
      const today = new Date().toISOString().slice(0, 10);
      const validDates = dates.filter((d: string) => d >= today);
      if (validDates.length === 0) {
        return NextResponse.json({ ok: true, note: 'No future dates to flush' });
      }
      const { data, error } = await supabaseAdmin
        .from('schedule_slots')
        .select('id')
        .in('date', validDates);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      ids = (data ?? []).map(r => r.id);
    } else {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    // De-dup & short-circuit if nothing to flush
    ids = Array.from(new Set(ids));
    if (ids.length === 0) {
      return NextResponse.json({ ok: true, flushed: 0, refunded: 0, removed_participants: 0 });
    }

    // Refund + cancel + delete
    const { data: result, error: rpcErr } = await supabaseAdmin
      .rpc('cancel_slots_and_refund', { p_slot_ids: ids });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

    // You might also enqueue “class cancelled” emails here based on the flushed slot ids

    return NextResponse.json({
      ok: true,
      flushed: ids.length,
      refunded: result?.[0]?.refunded ?? 0,
      removed_participants: result?.[0]?.removed_participants ?? 0,
      removed_slots: result?.[0]?.removed_slots ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}
