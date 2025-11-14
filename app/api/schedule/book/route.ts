import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { slotId, joinWaitIfFull } = await req.json();
    if (!slotId) return NextResponse.json({ error: 'Missing slotId' }, { status: 400 });

    // ✅ Auth via your session cookie
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value; // 'sbx_session'
    const sess = await verifySession(token);
    if (!sess?.aid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const athleteId = sess.aid;

    // Load athlete (for credits)
    const { data: athlete, error: meErr } = await supabaseAdmin
      .from('athletes')
      .select('id, credits')
      .eq('id', athleteId)
      .maybeSingle();
    if (meErr) return NextResponse.json({ error: meErr.message }, { status: 500 });
    if (!athlete) return NextResponse.json({ error: 'No athlete' }, { status: 403 });

    // Slot info
    const { data: slot, error: slotErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('id, date, time, capacity_main')
      .eq('id', slotId)
      .maybeSingle();
    if (slotErr) return NextResponse.json({ error: slotErr.message }, { status: 500 });
    if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });

    // Rule 1: booking window −23h…−1h (Europe/Athens)
    const now = new Date();
    const start = new Date(`${slot.date}T${slot.time}:00+02:00`);
    const h = (+start - +now) / 36e5;
    if (!(h <= 23 && h >= 1)) {
      return NextResponse.json({ error: 'Not in booking window' }, { status: 409 });
    }

    // Rule 2: only one class same day
    const { data: daySlots } = await supabaseAdmin
      .from('schedule_slots')
      .select('id')
      .eq('date', slot.date);
    if (daySlots?.length) {
      const { data: already } = await supabaseAdmin
        .from('schedule_participants')
        .select('slot_id')
        .eq('athlete_id', athleteId)
        .in('slot_id', daySlots.map(s => s.id));
      if ((already ?? []).length) {
        return NextResponse.json({ error: 'Already booked that day' }, { status: 409 });
      }
    }

    // Live counts
    const { data: counts, error: cErr } = await supabaseAdmin.rpc('live_counts', { p_slot_id: slot.id });
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    const mainHasSpace = (counts?.booked_main ?? 0) < (slot.capacity_main ?? 0);

    if (mainHasSpace) {
      // Rule 4: credit required for MAIN
      if ((athlete.credits ?? 0) <= 0) {
        return NextResponse.json({ error: 'No credits left' }, { status: 402 });
      }
      // Atomic: decrement credit + insert MAIN
      const { error: txErr } = await supabaseAdmin.rpc('perform_main_booking', {
        p_slot_id: slot.id,
        p_athlete_id: athleteId,
      });
      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, joined: 'main' });
    }

    // Rule 11: join waitlist
    if (joinWaitIfFull) {
      const { error: wErr } = await supabaseAdmin
        .from('schedule_participants')
        .insert({ slot_id: slot.id, athlete_id: athleteId, list_type: 'wait' });
      if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

      return NextResponse.json({ ok: true, joined: 'wait' });
    }

    return NextResponse.json({ error: 'Full. Waitlist available.' }, { status: 409 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}
