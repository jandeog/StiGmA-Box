import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const { slotId } = await req.json();
    if (!slotId) return NextResponse.json({ error: 'Missing slotId' }, { status: 400 });

    // ✅ Auth via your session cookie
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value; // 'sbx_session'
    const sess = await verifySession(token);
    if (!sess?.aid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const athleteId = sess.aid;

    // Slot
    const { data: slot, error: sErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('id, date, time')
      .eq('id', slotId)
      .maybeSingle();
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });

    // Time window for cancel: only ≥ 2h before start
    const start = new Date(`${slot.date}T${slot.time}:00+02:00`);
    const h = (+start - +new Date()) / 36e5;

    // Check participant
    const { data: part } = await supabaseAdmin
      .from('schedule_participants')
      .select('list_type')
      .eq('slot_id', slotId)
      .eq('athlete_id', athleteId)
      .maybeSingle();
    if (!part) return NextResponse.json({ error: 'Not booked' }, { status: 409 });

    // Delete participation
    const { error: delErr } = await supabaseAdmin
      .from('schedule_participants')
      .delete()
      .eq('slot_id', slotId)
      .eq('athlete_id', athleteId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    // Refund only if MAIN and timely
    if (part.list_type === 'main' && h >= 2) {
      await supabaseAdmin.rpc('refund_credit', { p_athlete_id: athleteId });
    }

    // Promote first from waitlist if a MAIN seat freed
    if (part.list_type === 'main') {
      await supabaseAdmin.rpc('promote_waiter', { _slot_id: slotId });
    }

    return NextResponse.json({ ok: true, timely: h >= 2 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}
