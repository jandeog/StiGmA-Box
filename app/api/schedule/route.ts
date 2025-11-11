import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

    // ✅ Auth via project session cookie
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const sess = await verifySession(token);
    if (!sess?.aid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const athleteId = sess.aid;

    // Load me (credits & name if you want to render them)
    const { data: meRow, error: meErr } = await supabaseAdmin
      .from('athletes')
      .select('id, credits, first_name, last_name, is_coach')
      .eq('id', athleteId)
      .maybeSingle();
    if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });
    if (!meRow) return NextResponse.json({ error: 'No athlete' }, { status: 403 });

    // Fetch slots for the day
    const { data: slots, error: sErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('id, date, time, title, capacity_main, capacity_wait')
      .eq('date', date)
      .order('time', { ascending: true });
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    if (!slots || slots.length === 0) {
      return noStore({ items: [] });
    }

    const slotIds = slots.map(s => s.id);

    // Live counts (main/wait) per slot
    const { data: counts, error: cErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('slot_id, list_type')
      .in('slot_id', slotIds);
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    const mainCounts = new Map<string, number>();
    const waitCounts = new Map<string, number>();
    for (const p of counts ?? []) {
      if (p.list_type === 'main') {
        mainCounts.set(p.slot_id, (mainCounts.get(p.slot_id) ?? 0) + 1);
      } else if (p.list_type === 'wait') {
        waitCounts.set(p.slot_id, (waitCounts.get(p.slot_id) ?? 0) + 1);
      }
    }

    // Main names per slot (comma-delimited)
    const { data: nameRows, error: nErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('slot_id, list_type, athletes!inner(first_name, last_name)')
      .in('slot_id', slotIds)
      .eq('list_type', 'main');
    if (nErr) return NextResponse.json({ error: nErr.message }, { status: 500 });

    const namesMap = new Map<string, string[]>();
    for (const r of nameRows ?? []) {
      const a = (r as any).athletes;
      const full = [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim();
      if (!full) continue;
      const arr = namesMap.get(r.slot_id) ?? [];
      arr.push(full);
      namesMap.set(r.slot_id, arr);
    }

    // Which slot (if any) is mine this day?
    const { data: mineRows, error: mErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('slot_id, list_type')
      .in('slot_id', slotIds)
      .eq('athlete_id', athleteId);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    const mySlotIds = new Set<string>((mineRows ?? []).map(r => r.slot_id));

    // Build response with flags for the UI
    const now = new Date();
    const items = slots.map(s => {
      const start = new Date(`${s.date}T${s.time}:00+02:00`); // Europe/Athens
      const h = (+start - +now) / 36e5;

      const booked_main = mainCounts.get(s.id) ?? 0;
      const booked_wait = waitCounts.get(s.id) ?? 0;
      const main_names = (namesMap.get(s.id) ?? []).sort((a, b) => a.localeCompare(b)).join(', ');

      const withinWindow = h <= 23 && h >= 1;
      const hasMainSpace = booked_main < (s.capacity_main ?? 0);
      const isMine = mySlotIds.has(s.id);
      const canCancel = isMine && h >= 2;

      // If I'm already booked in ANY slot that day, I can't book another
      const alreadyBookedThatDay = mySlotIds.size > 0;

      const canBookMain =
        withinWindow &&
        hasMainSpace &&
        !alreadyBookedThatDay &&
        !isMine &&
        (meRow.credits ?? 0) > 0;

      const canWait =
        withinWindow &&
        !hasMainSpace &&
        !alreadyBookedThatDay &&
        !isMine;

      return {
        ...s,
        booked_main,
        booked_wait,
        main_names,
        me: { id: meRow.id, credits: meRow.credits },
        flags: { withinWindow, hasMainSpace, isMine, canCancel, canBookMain, canWait },
      };
    });

    return noStore({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}

// Utility to disable caching for this endpoint
function noStore(payload: any, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store, no-cache, must-revalidate',
      pragma: 'no-cache',
    },
  });
}
