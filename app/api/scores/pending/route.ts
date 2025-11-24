// app/api/scores/pending/route.ts
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

  // LOCAL start datetime
  const start = new Date(y, m - 1, d, h, min);

  // Duration of class
  const CLASS_LENGTH_MIN = 60;
  const end = new Date(start.getTime() + CLASS_LENGTH_MIN * 60 * 1000);

  return Date.now() >= end.getTime();
}


export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;
  if (!token) return unauthorized();

  const session = await verifySession(token);
  if (!session?.aid) return unauthorized();

  const athleteId = session.aid as string;

  // 1) All main-list participations for this athlete (attended true OR false)
  const { data: participants, error: partError } = await supabaseAdmin
    .from('schedule_participants')
    .select(
      `
        id,
        slot_id,
        athlete_id,
        list_type,
        attended,
        attended_at,
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
    console.error('pending-scores: schedule_participants error', partError);
    return json({ error: 'Failed to load bookings' }, 500);
  }

  if (!participants?.length) return json({ items: [] });

  const slotIds = Array.from(
    new Set(
      participants
        .map((p: any) => p.slot_id as string | null)
        .filter((x): x is string => !!x),
    ),
  );
  if (!slotIds.length) return json({ items: [] });

  // 2) Scores for these slots
  const { data: scores, error: scoresError } = await supabaseAdmin
    .from('wod_scores')
    .select('id, class_slot_id')
    .eq('athlete_id', athleteId)
    .in('class_slot_id', slotIds);

  if (scoresError) {
    console.error('pending-scores: wod_scores error', scoresError);
    return json({ error: 'Failed to load scores' }, 500);
  }

  const scoredSlotIds = new Set(
    (scores ?? []).map((s: any) => s.class_slot_id as string),
  );

// --- NEW: load WOD configs for the dates of these slots ---

// Collect unique dates (YYYY-MM-DD) from slots
const dateKeys = Array.from(
  new Set(
    (participants ?? [])
      .map((p: any) => {
        const slot = p.slot;
        const rawDate = (slot?.date as string | null) ?? null;
        return rawDate ? rawDate.slice(0, 10) : null;
      })
      .filter((d): d is string => !!d),
  ),
);

let wodConfigByDate = new Map<
  string,
  { record_main_score: boolean | null; strength_record_score: boolean | null }
>();

if (dateKeys.length > 0) {
  const { data: wodRows, error: wodError } = await supabaseAdmin
    .from('Wod')
    .select('date_local, record_main_score, strength_record_score')
    .in('date_local', dateKeys);

  if (wodError) {
    console.error('pending-scores: Wod config error', wodError);
  } else {
    wodConfigByDate = new Map(
      (wodRows ?? []).map((w: any) => [
        (w.date_local as string).slice(0, 10),
        {
          record_main_score: w.record_main_score as boolean | null,
          strength_record_score: w.strength_record_score as boolean | null,
        },
      ]),
    );
  }
}

// 3) Build pending list: booked, no score, AND WOD actually requires score
const pending = (participants ?? [])
  .map((p: any) => {
    const slot = p.slot;
    const slotId = p.slot_id as string;
    const rawDate = (slot?.date as string | null) ?? null;
    const timeRaw = (slot?.time as string | null) ?? null;
    const hasScore = scoredSlotIds.has(slotId);

    if (!rawDate) return null;
    const dateKey = rawDate.slice(0, 10);

    // 🚫 If class has not finished yet, don’t ask for a score
    if (!isClassFinished(dateKey, timeRaw)) {
      return null;
    }
    // Look up WOD config for that date
    const cfg = wodConfigByDate.get(dateKey);
    const recordMain = cfg?.record_main_score ?? true;
    const recordStrength = cfg?.strength_record_score ?? false;

    // ❌ If BOTH are false, no score is needed -> skip
    if (!recordMain && !recordStrength) {
      return null;
    }

    return {
      participantId: p.id as string,
      slotId,
      date: dateKey,
      time: timeRaw ? timeRaw.slice(0, 5) : null,
      hasScore,
    };
  })
  // keep only entries that exist and have no score
.filter((x) => !!x && !x.hasScore);


  return json({ items: pending });
}
