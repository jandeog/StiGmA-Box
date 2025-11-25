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

// GET /api/scores/dates?athleteId=...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const cookieStore = await cookies();
  const athleteId = url.searchParams.get('athleteId');

  const cookie = cookieStore.get(SESSION_COOKIE)?.value || null;
  if (!cookie) return unauthorized();

  const session = await verifySession(cookie);
  if (!session) return unauthorized();

  if (!athleteId) {
    return badRequest('Missing athleteId');
  }

  // Optional: lock athletes to only their own scores
  // if (!session.is_coach && session.id !== athleteId) return unauthorized();

  const { data, error } = await supabaseAdmin
    .from('wod_scores')          // ✅ FIX: use wod_scores, not scores
    .select('wod_date')          // ✅ assumes column is wod_date
    .eq('athlete_id', athleteId);

  if (error) {
    console.error('scores/dates error', error);
    return json({ error: 'Failed to load score dates' }, 500);
  }

  const datesSet = new Set<string>();

  for (const row of data ?? []) {
    const raw = (row as any).wod_date;
    if (!raw) continue;

    const iso =
      typeof raw === 'string'
        ? new Date(raw).toISOString().slice(0, 10)
        : new Date(raw as Date).toISOString().slice(0, 10);

    datesSet.add(iso);
  }

  return json({ dates: Array.from(datesSet).sort() });
}
