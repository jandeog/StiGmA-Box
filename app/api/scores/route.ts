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

// -------------------- GET: scores for a given date --------------------

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
        class_slot:class_slot_id (
          time
        ),
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

// -------------------- POST: save scores / verify attendance --------------------

/**
 * Body shape:
 * {
 *   date: "YYYY-MM-DD",
 *   athleteId: string,
 *   strength: { rxScaled: "RX" | "Scaled", value: string } | null,
 *   main: { rxScaled: "RX" | "Scaled", value: string } | null,
 *   classSlotId: string | null,  // ignored now – backend auto-resolves from bookings
 *   noScore?: boolean,           // athlete: "Don't remember / Don't want to"
 *   chargeCredit?: boolean       // coach: charge one credit when scoring
 * }
 */
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
  // classSlotId from client is ignored – we infer from schedule_participants
  const noScore = !!body?.noScore;
  const chargeCredit = !!body?.chargeCredit;

  if (!date || !athleteId) {
    return badRequest('Missing date or athleteId');
  }

  const isCoach = session.role === 'coach';

  // Athletes can only submit for themselves. Coaches can submit for anyone.
  if (!isCoach && athleteId !== session.aid) {
    return json(
      { error: 'You can only submit scores for yourself.' },
      403,
    );
  }

  const hasStrength = !!strength && strength.value?.trim();
  const hasMain = !!main && main.value?.trim();
  const wantsNoScore = noScore;

  if (!hasStrength && !hasMain && !wantsNoScore) {
    return badRequest('Nothing to submit.');
  }

  // -------------------- Resolve class slot from schedule_participants --------------------

  // All classes for that date
  const { data: daySlots, error: slotsErr } = await supabaseAdmin
    .from('schedule_slots')
    .select('id, date, time')
    .eq('date', date)
    .order('time', { ascending: true });

  if (slotsErr) {
    console.error('POST /api/scores: schedule_slots error', slotsErr);
    return json({ error: 'Failed to load classes for this date' }, 500);
  }

  const slots = daySlots ?? [];
  const slotIds = slots.map((s) => s.id as string);

  type BookingRow = { id: string; slot_id: string; attended: boolean | null };

  let bookingForDay: BookingRow | null = null;
  let classSlotIdToUse: string | null = null;
  let hadBookingBefore = false; // <— NEW

  if (slotIds.length > 0) {
    const { data: bookings, error: bookingErr } = await supabaseAdmin
      .from('schedule_participants')
      .select('id, slot_id, attended')
      .eq('athlete_id', athleteId)
      .in('slot_id', slotIds);

    if (bookingErr) {
      console.error('schedule_participants lookup failed', bookingErr);
      return json({ error: 'Failed to check booking' }, 500);
    }

    if (bookings && bookings.length > 0) {
      hadBookingBefore = true; // <— athlete was already booked

      // Pick the earliest booked class of the day
      const timeBySlot = new Map(
        slots.map((s) => [s.id as string, s.time as string]),
      );

      const sortedBookings = [...bookings].sort((a, b) => {
        const ta = timeBySlot.get(a.slot_id) ?? '';
        const tb = timeBySlot.get(b.slot_id) ?? '';
        return ta.localeCompare(tb);
      });

      bookingForDay = sortedBookings[0] as BookingRow;
      classSlotIdToUse = bookingForDay.slot_id;
    }
  }

  // RULE 1: athlete must have booking for that day
  if (!isCoach && !bookingForDay) {
    return json(
      {
        error:
          'You do not have a booking for a class on this day. Ask your coach if you attended as a walk-in.',
      },
      403,
    );
  }

  // RULE 2: coach can create booking + attendance if none exists
  if (isCoach && !bookingForDay && slots.length > 0) {
    const chosenSlot = slots[0]; // earliest class of that date
    classSlotIdToUse = chosenSlot.id as string;

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('schedule_participants')
      .insert({
        slot_id: classSlotIdToUse,
        athlete_id: athleteId,
        list_type: 'main',
        attended: true,
        attended_at: new Date().toISOString(),
      })
      .select('id, slot_id, attended')
      .maybeSingle();

    if (insertErr || !inserted) {
      console.error(
        'Failed to create schedule_participants from coach score',
        insertErr,
      );
      return json({ error: 'Failed to mark booking/attendance' }, 500);
    }

    bookingForDay = inserted as BookingRow;
  }

  // If we now have a booking, make sure it's marked attended
  if (bookingForDay && !bookingForDay.attended) {
    const { error: updErr } = await supabaseAdmin
      .from('schedule_participants')
      .update({
        attended: true,
        attended_at: new Date().toISOString(),
      })
      .eq('id', bookingForDay.id);

    if (updErr) {
      console.error('Failed to update schedule_participants.attended', updErr);
    }
  }

  // Attendance table entry (UPSERT to avoid duplicates)
if (classSlotIdToUse) {
  const method = isCoach ? 'coach_toggle' : 'booked';

  const { error: attErr } = await supabaseAdmin
    .from('attendance')
    .upsert(
      {
        slot_id: classSlotIdToUse,
        athlete_id: athleteId,
        method,
        attended: true,
        attended_at: new Date().toISOString(),
      },
      {
        onConflict: 'slot_id,athlete_id',
        ignoreDuplicates: false, // update existing row instead of ignoring
      },
    );

  if (attErr) {
    console.error('Failed to upsert attendance from /api/scores', attErr);
  }
}




  // -------------------- Optional credit charge (coach only) --------------------

   if (isCoach && chargeCredit && classSlotIdToUse && !hadBookingBefore) {

    // Simple (non-atomic) credit decrement
    const { data: current, error: loadErr } = await supabaseAdmin
      .from('athletes')
      .select('credits')
      .eq('id', athleteId)
      .maybeSingle();

    if (loadErr) {
      console.error('Failed to load credits in /api/scores', loadErr);
      return json({ error: 'Failed to check athlete credits' }, 500);
    }

    if (!current || current.credits == null || current.credits <= 0) {
      return json(
        { error: 'No credits available for this athlete to charge.' },
        400,
      );
    }

    const { data: updated, error: creditErr } = await supabaseAdmin
      .from('athletes')
      .update({ credits: current.credits - 1 })
      .eq('id', athleteId)
      .select('credits')
      .maybeSingle();

    if (creditErr) {
      console.error('Failed to charge credit in /api/scores', creditErr);
      return json({ error: 'Failed to charge credit' }, 500);
    }

    if (!updated) {
      return json(
        { error: 'No credits available for this athlete to charge.' },
        400,
      );
    }
  }

  // -------------------- Prepare wod_scores rows (or none if noScore) --------------------

  const rows: any[] = [];
  const nowIso = new Date().toISOString();

  if (!wantsNoScore) {
    if (hasStrength) {
      rows.push({
        athlete_id: athleteId,
        wod_date: date,
        part: 'strength',
        rx_scaled: strength!.rxScaled === 'Scaled' ? 'Scaled' : 'RX',
        score: strength!.value!.trim(),
        class_slot_id: classSlotIdToUse,
        created_at: nowIso,
      });
    }

    if (hasMain) {
      rows.push({
        athlete_id: athleteId,
        wod_date: date,
        part: 'main',
        rx_scaled: main!.rxScaled === 'Scaled' ? 'Scaled' : 'RX',
        score: main!.value!.trim(),
        class_slot_id: classSlotIdToUse,
        created_at: nowIso,
      });
    }
  }

  // Only verified attendance via "Don't remember / Don't want to"
  if (rows.length === 0) {
    return json({
      ok: true,
      inserted: [],
      verifiedOnly: true,
    });
  }

  // -------------------- Prevent duplicate part submissions --------------------

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('wod_scores')
    .select('id, part')
    .eq('wod_date', date)
    .eq('athlete_id', athleteId);

  if (existingErr) {
    console.error('check existing wod_scores failed', existingErr);
    return json({ error: 'Failed to save scores' }, 500);
  }

  if (
    existing?.some((r: any) => r.part === 'strength') &&
    rows.some((r) => r.part === 'strength')
  ) {
    return json(
      { error: 'Strength score already submitted for this athlete and day.' },
      409,
    );
  }

  if (
    existing?.some((r: any) => r.part === 'main') &&
    rows.some((r) => r.part === 'main')
  ) {
    return json(
      { error: 'Main WOD score already submitted for this athlete and day.' },
      409,
    );
  }

  // -------------------- Insert scores --------------------

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('wod_scores')
    .insert(rows)
    .select('id, part');

  if (insertErr) {
    console.error('insert wod_scores failed', insertErr);
    return json({ error: 'Failed to save scores' }, 500);
  }

  return json({ ok: true, inserted: inserted ?? [] });
}
