// app/api/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// -------------------------- utils --------------------------

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

async function populateFromTemplateForDate(dateIso: string) {
  // JS weekday 0..6 (Sun..Sat); ensure it matches your template convention
  const dow = new Date(dateIso + 'T00:00:00Z').getUTCDay();

  const { data: template, error: tplErr } = await supabaseAdmin
    .from('schedule_template')
    .select('time, title, capacity_main, capacity_wait, enabled')
    .eq('day_of_week', dow)
    .eq('enabled', true);
  if (tplErr) throw tplErr;

  if (!template || template.length === 0) return;

  // Normalize HH:MM and dedupe by time
  const normalize = (t: string) => {
    const v = (t || '').trim();
    // keep HH:MM only
    const m = v.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return v;
    const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
    const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const byTime = new Map<string, { time: string; title: string; capacity_main: number; capacity_wait: number }>();
  for (const t of template) {
    const time = normalize(t.time);
    if (!byTime.has(time)) {
      byTime.set(time, {
        time,
        title: t.title,
        capacity_main: Number(t.capacity_main),
        capacity_wait: Number(t.capacity_wait),
      });
    }
  }

  const rows = Array.from(byTime.values()).map((t) => ({
    date: dateIso,
    time: t.time,
    title: t.title,
    capacity_main: t.capacity_main,
    capacity_wait: t.capacity_wait,
  }));

  if (rows.length === 0) return;

  // Upsert on (date,time) so parallel calls can’t duplicate
  const { error: upErr } = await supabaseAdmin
    .from('schedule_slots')
    .upsert(rows, { onConflict: 'date,time', ignoreDuplicates: true });
  if (upErr) throw upErr;
}


/** Refund one credit to each unique athlete who has a MAIN booking in any of the given slotIds. */
async function refundCreditsForMainBookings(slotIds: string[]) {
  if (!slotIds.length) return 0;

  const { data: mains, error: mainsErr } = await supabaseAdmin
    .from('schedule_participants')
    .select('athlete_id')
    .in('slot_id', slotIds)
    .eq('list_type', 'main');
  if (mainsErr) throw new Error(mainsErr.message);

  const uniqueAthleteIds = Array.from(new Set((mains ?? []).map(m => m.athlete_id)));
  let refunded = 0;

  // Use your existing SQL helper if present:
  //   await supabaseAdmin.rpc('refund_credit', { p_athlete_id: id })
  // Otherwise loop updates (simple & reliable for moderate volumes).
  for (const id of uniqueAthleteIds) {
    const { error } = await supabaseAdmin.rpc('refund_credit', { p_athlete_id: id });
    if (!error) refunded += 1;
  }
  return refunded;
}

/** Cancel all participants for the given slots and delete the slots. Returns stats. */
async function cancelParticipantsAndDeleteSlots(slotIds: string[]) {
  if (!slotIds.length) return { removedParticipants: 0, removedSlots: 0 };

  const { error: delP } = await supabaseAdmin
    .from('schedule_participants')
    .delete()
    .in('slot_id', slotIds);
  if (delP) throw new Error(delP.message);

  const { error: delS, data: deletedRows } = await supabaseAdmin
  .from('schedule_slots')
  .delete()
  .in('id', slotIds)
  .select('id'); // ✅ returns deleted rows
if (delS) throw new Error(delS.message);

const removedSlots = deletedRows?.length ?? 0;
return { removedParticipants: 0, removedSlots };

}

// -------------------------- GET --------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    if (!date) return json({ error: 'Missing date' }, 400);

    // Auth via sbx_session
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const sess = await verifySession(token);
    if (!sess?.aid) return json({ error: 'Unauthorized' }, 401);
    const athleteId = sess.aid;

    // Load me (for credits & role)
    const { data: meRow, error: meErr } = await supabaseAdmin
      .from('athletes')
      .select('id, credits, first_name, last_name, is_coach')
      .eq('id', athleteId)
      .maybeSingle();
    if (meErr) return json({ error: meErr.message }, 500);
    if (!meRow) return json({ error: 'No athlete' }, 403);

    // Fetch slots for the date
    let { data: slots, error: sErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('id, date, time, title, capacity_main, capacity_wait')
      .eq('date', date)
      .order('time', { ascending: true });
    if (sErr) return json({ error: sErr.message }, 500);

    // Self-heal: If empty, populate from template for that date, then re-fetch
    if (!slots || slots.length === 0) {
      await populateFromTemplateForDate(date);
      const again = await supabaseAdmin
        .from('schedule_slots')
        .select('id, date, time, title, capacity_main, capacity_wait')
        .eq('date', date)
        .order('time', { ascending: true });
      if (again.error) return json({ error: again.error.message }, 500);
      slots = again.data ?? [];
      if (!slots.length) return json({ items: [] }); // still nothing (no enabled template)
    }

    const slotIds = slots.map(s => s.id);

    // Live counts for the day (single pass)
    const { data: counts, error: cErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('slot_id, list_type')
      .in('slot_id', slotIds);
    if (cErr) return json({ error: cErr.message }, 500);

    const mainCounts = new Map<string, number>();
    const waitCounts = new Map<string, number>();
    for (const p of counts ?? []) {
      if (p.list_type === 'main') mainCounts.set(p.slot_id, (mainCounts.get(p.slot_id) ?? 0) + 1);
      else if (p.list_type === 'wait') waitCounts.set(p.slot_id, (waitCounts.get(p.slot_id) ?? 0) + 1);
    }

    // Names of MAIN participants (comma-delimited per slot)
    const { data: nameRows, error: nErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('slot_id, list_type, athletes!inner(first_name, last_name)')
      .in('slot_id', slotIds)
      .eq('list_type', 'main');
    if (nErr) return json({ error: nErr.message }, 500);

    const namesMap = new Map<string, string[]>();
    for (const r of nameRows ?? []) {
      const a = (r as any).athletes;
      const full = [a?.first_name, a?.last_name].filter(Boolean).join(' ').trim();
      if (!full) continue;
      const arr = namesMap.get(r.slot_id) ?? [];
      arr.push(full);
      namesMap.set(r.slot_id, arr);
    }

    // My participation (which slot is mine)
    const { data: mineRows, error: mErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('slot_id, list_type')
      .in('slot_id', slotIds)
      .eq('athlete_id', meRow.id);
    if (mErr) return json({ error: mErr.message }, 500);

    const mySlotIds = new Set<string>((mineRows ?? []).map(r => r.slot_id));

    // Build response items with UI flags
    const now = new Date();

    const items = slots.map(s => {
      const start = new Date(`${s.date}T${s.time}:00+02:00`); // Europe/Athens (wall clock)
      const h = (+start - +now) / 36e5;

      const booked_main = mainCounts.get(s.id) ?? 0;
      const booked_wait = waitCounts.get(s.id) ?? 0;
      const main_names = (namesMap.get(s.id) ?? []).sort((a, b) => a.localeCompare(b)).join(', ');

      const withinWindow = h <= 23 && h >= 1;
      const hasMainSpace = booked_main < (s.capacity_main ?? 0);
      const isMine = mySlotIds.has(s.id);
      const alreadyBookedThatDay = mySlotIds.size > 0;

      const canBookMain =
        withinWindow && hasMainSpace && !alreadyBookedThatDay && !isMine && (meRow.credits ?? 0) > 0;

      const canWait =
        withinWindow && !hasMainSpace && !alreadyBookedThatDay && !isMine;

      // cancel allowed until start; inside 2h credit is lost (UI can show a warning)
      const canCancel = isMine && h > 0;
      const lateCancelCreditLost = isMine && h > 0 && h < 2;

      return {
        ...s,
        booked_main,
        booked_wait,
        main_names,
        me: { id: meRow.id, credits: meRow.credits },
        flags: {
          withinWindow,
          hasMainSpace,
          isMine,
          canCancel,
          canBookMain,
          canWait,
          lateCancelCreditLost,
        },
      };
    });

    return json({ items });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Failed' }, 500);
  }
}

// -------------------------- POST (coach) --------------------------

type TemplatePayload = {
  mode: 'template';
  applyAllWeekdays: boolean;
  dow: number; // 0..6 when applyAllWeekdays === false
  slots: Array<{
    time: string;
    title: string;
    capacity_main: number;
    capacity_wait: number;
    enabled: boolean;
  }>;
};

type SpecificPayload = {
  mode: 'specific';
  date: string; // 'YYYY-MM-DD'
  slots: Array<{
    time: string;
    title: string;
    capacity_main: number;
    capacity_wait: number;
    enabled: boolean;
  }>;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TemplatePayload | SpecificPayload;

    // Auth (coach)
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const sess = await verifySession(token);
    if (!sess?.aid) return json({ error: 'Unauthorized' }, 401);

    const { data: me, error: meErr } = await supabaseAdmin
      .from('athletes')
      .select('id, is_coach')
      .eq('id', sess.aid)
      .maybeSingle();
    if (meErr) return json({ error: meErr.message }, 500);
    if (!me?.is_coach) return json({ error: 'Forbidden' }, 403);

    const today = new Date().toISOString().slice(0, 10);

    // ----- MODE: TEMPLATE (all weekdays or one weekday) -----
    if (body.mode === 'template') {
      const weekdays = body.applyAllWeekdays ? [0, 1, 2, 3, 4, 5, 6] : [body.dow];

      // 1) Replace template rows for targeted weekdays
      const { error: delTplErr } = await supabaseAdmin
        .from('schedule_template')
        .delete()
        .in('day_of_week', weekdays);
      if (delTplErr) return json({ error: delTplErr.message }, 500);

      const tplRows = weekdays.flatMap((w) =>
        body.slots.map((s) => ({
          day_of_week: w,
          time: s.time,
          title: s.title,
          capacity_main: Number(s.capacity_main),
          capacity_wait: Number(s.capacity_wait),
          enabled: !!s.enabled,
        })),
      );
      if (tplRows.length) {
        const { error: insTplErr } = await supabaseAdmin.from('schedule_template').insert(tplRows);
        if (insTplErr) return json({ error: insTplErr.message }, 500);
      }

      // 2) Find future slots that match those weekdays (today and later)
      const { data: futureSlots, error: findErr } = await supabaseAdmin
        .from('schedule_slots')
        .select('id, date')
        .gte('date', today);
      if (findErr) return json({ error: findErr.message }, 500);

      const idsToFlush = (futureSlots ?? [])
        .filter((row) => weekdays.includes(new Date((row as any).date + 'T00:00:00').getDay()))
        .map((row) => (row as any).id);

      // 3) Refund credits for MAIN, delete participants, delete slots
      const refunded = await refundCreditsForMainBookings(idsToFlush);
      const { removedParticipants, removedSlots } = await cancelParticipantsAndDeleteSlots(idsToFlush);

      return json({
        ok: true,
        scope: { weekdays },
        refunded,
        removed_participants: removedParticipants,
        removed_slots: removedSlots,
      });
    }

    // ----- MODE: SPECIFIC DATE -----
    if (body.mode === 'specific') {
      const date = body.date;
      if (!date) return json({ error: 'Missing date' }, 400);
      if (date < today) return json({ error: 'Cannot modify past dates' }, 400);

      // 1) Collect existing slot ids for that date
      const { data: daySlots, error: dayErr } = await supabaseAdmin
        .from('schedule_slots')
        .select('id')
        .eq('date', date);
      if (dayErr) return json({ error: dayErr.message }, 500);

      const ids = (daySlots ?? []).map((r) => r.id);

      // 2) Refund/cancel/delete the day’s current slots
      const refunded = await refundCreditsForMainBookings(ids);
      const { removedParticipants, removedSlots } = await cancelParticipantsAndDeleteSlots(ids);

      // 3) Insert new slots (only enabled ones)
      const toInsert = body.slots
        .filter((s) => !!s.enabled)
        .map((s) => ({
          date,
          time: s.time,
          title: s.title,
          capacity_main: Number(s.capacity_main),
          capacity_wait: Number(s.capacity_wait),
        }));

      if (toInsert.length) {
        const { error: insErr } = await supabaseAdmin.from('schedule_slots').insert(toInsert);
        if (insErr) return json({ error: insErr.message }, 500);
      }

      return json({
        ok: true,
        date,
        inserted: toInsert.length,
        refunded,
        removed_participants: removedParticipants,
        removed_slots: removedSlots,
      });
    }

    return json({ error: 'Invalid mode' }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? 'Failed' }, 500);
  }
}
