// app/api/scores/eligibility/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function json(data: any, init?: number | ResponseInit) {
  if (typeof init === 'number') return NextResponse.json(data, { status: init });
  return NextResponse.json(data, init);
}

function unauthorized() {
  return json({ error: 'Not authenticated' }, 401);
}

// Class is "finished" when local start time + CLASS_LENGTH_MIN has passed
function isClassFinished(dateStr?: string | null, timeStr?: string | null): boolean {
  if (!dateStr) return false;

  // dateStr: "YYYY-MM-DD"
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!y || !m || !d) return false;

  // timeStr: "HH:MM"
  let h = 0;
  let min = 0;
  if (timeStr) {
    const [hStr, minStr] = timeStr.split(':');
    h = Number(hStr) || 0;
    min = Number(minStr) || 0;
  }

  // Local start datetime
  const start = new Date(y, m - 1, d, h, min);

  // Adjust this to your real class length if needed
  const CLASS_LENGTH_MIN = 60;
  const end = new Date(start.getTime() + CLASS_LENGTH_MIN * 60 * 1000);

  return Date.now() >= end.getTime();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get('date'); // "YYYY-MM-DD"

  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    // If date is missing/invalid, just say "no booking"
    return json({ hasBooking: false, hasFinishedBooking: false });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;
  if (!token) return unauthorized();

  const session = await verifySession(token);
  if (!session?.aid) return unauthorized();

  const athleteId = session.aid as string;

  // 1) All main-list participations for this athlete
  const { data: participants, error: partError } = await supabaseAdmin
    .from('schedule_participants')
    .select(
      `
        id,
        slot_id,
        athlete_id,
        list_type,
        slot:schedule_slots (
          id,
          date,
          time
        )
      `,
    )
    .eq('athlete_id', athleteId)
    .eq('list_type', 'main');

  if (partError) {
    console.error('scores/eligibility: schedule_participants error', partError);
    return json({ error: 'Failed to load bookings' }, 500);
  }

  if (!participants?.length) {
    return json({ hasBooking: false, hasFinishedBooking: false });
  }

  // 2) Filter those bookings to the selected date
  const bookingsForDay = (participants as any[]).filter((p) => {
    const slot = p.slot;
    if (!slot) return false;

    // slot.date is timestamptz → take YYYY-MM-DD
    const rawDate: string | null = (slot.date as string | null) ?? null;
    const dateKey = rawDate ? rawDate.slice(0, 10) : null;

    return dateKey === dateParam;
  });

  if (!bookingsForDay.length) {
    return json({ hasBooking: false, hasFinishedBooking: false });
  }

  const hasBooking = true;

  // 3) Has at least one booking whose class has already finished?
  const hasFinishedBooking = bookingsForDay.some((p) => {
    const slot = p.slot;
    if (!slot) return false;

    const rawDate: string | null = (slot.date as string | null) ?? null;
    const dateKey = rawDate ? rawDate.slice(0, 10) : null;
    const timeStr: string | null = (slot.time as string | null) ?? null;

    return isClassFinished(dateKey, timeStr);
  });

  return json({ hasBooking, hasFinishedBooking });
}
