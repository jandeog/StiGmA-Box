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

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;
  if (!token) return unauthorized();

  const session = await verifySession(token);
  if (!session?.aid) return unauthorized();

  const athleteId = session.aid as string;

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
    .eq('list_type', 'main')
    .eq('attended', false);

  if (partError) {
    console.error('pending-scores: schedule_participants error', partError);
    return json({ error: 'Failed to load bookings' }, 500);
  }

  if (!participants?.length) {
    return json({ items: [] });
  }

  const slotIds = Array.from(
    new Set(
      participants
        .map((p: any) => p.slot_id as string | null)
        .filter((x): x is string => !!x),
    ),
  );

  if (!slotIds.length) {
    return json({ items: [] });
  }

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

  const pending = (participants ?? [])
    .map((p: any) => {
      const slot = p.slot;
      const rawDate = (slot?.date as string | null) ?? null;
      const timeRaw = (slot?.time as string | null) ?? null;
      const slotId = p.slot_id as string;
      const hasScore = scoredSlotIds.has(slotId);

      return {
        participantId: p.id as string,
        slotId,
        date: rawDate,                         // <-- important
        time: timeRaw ? timeRaw.slice(0, 5) : null,
        hasScore,
      };
    })
    .filter((x) => !x.hasScore && x.date != null);

  return json({ items: pending });
}
