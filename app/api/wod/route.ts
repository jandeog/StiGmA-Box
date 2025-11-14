// app/api/wod/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function json(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

async function getMe(aid?: string): Promise<{ isCoach: boolean } | null> {
  if (!aid) return null;
  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select('is_coach')
    .eq('id', aid)
    .maybeSingle();
  if (error) return null;
  return { isCoach: !!data?.is_coach };
}

/**
 * Athlete visibility rule:
 * - Past days (date < today[Athens]) => allowed
 * - Today => allowed only if they have a booking whose start time <= now[Athens]
 * - Future => not allowed
 */
async function athleteCanViewDate(aid: string, yyyy_mm_dd: string) {
  const tz = 'Europe/Athens';

  const now = new Date();
  const y = new Intl.DateTimeFormat('en', { timeZone: tz, year: 'numeric' }).format(now);
  const m = new Intl.DateTimeFormat('en', { timeZone: tz, month: '2-digit' }).format(now);
  const d = new Intl.DateTimeFormat('en', { timeZone: tz, day: '2-digit' }).format(now);
  const today = `${y}-${m}-${d}`;

  if (yyyy_mm_dd < today) return true;
  if (yyyy_mm_dd > today) return false;

  // date === today → need booking at or before now
  const nowLocalHHMM = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now); // "HH:MM"

  const { data, error } = await supabaseAdmin
    .from('schedule_participants')
    .select('slot_id, slots:slot_id!inner(date,time)')
    .eq('athlete_id', aid)
    .eq('slots.date', today)
    .lte('slots.time', nowLocalHHMM)
    .limit(1);

  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const suggest = searchParams.get('suggest'); // 'main' | 'strength' (coach only)
    const q = searchParams.get('q')?.trim() || '';
    const date = searchParams.get('date')?.trim(); // YYYY-MM-DD

    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const sess = await verifySession(token);
    if (!sess?.aid) return json({ error: 'Unauthorized' }, 401);

    const me = await getMe(sess.aid);
    const isCoach = !!me?.isCoach;

    // Suggestions (coach only)
    if (suggest === 'main' || suggest === 'strength') {
      if (!isCoach) return json({ error: 'Forbidden' }, 403);
      if (!q) return json([]);

      if (suggest === 'main') {
        const { data, error } = await supabaseAdmin
          .from('Wod')
          .select('title, description, scoring, "timeCap"')
          .ilike('title', `%${q}%`)
          .limit(10);
        if (error) return json({ error: error.message }, 500);
        return json(
          (data ?? []).map((w) => ({
            title: w.title,
            description: w.description,
            scoring: w.scoring,
            timeCap: (w as any).timeCap ?? null,
          })),
        );
      } else {
        const { data, error } = await supabaseAdmin
          .from('Wod')
          .select('"strengthTitle","strengthDescription","strengthScoreHint"')
          .ilike('strengthTitle', `%${q}%`)
          .limit(10);
        if (error) return json({ error: error.message }, 500);
        return json(
          (data ?? []).map((w) => ({
            strengthTitle: (w as any).strengthTitle ?? null,
            strengthDescription: (w as any).strengthDescription ?? null,
            strengthScoreHint: (w as any).strengthScoreHint ?? null,
          })),
        );
      }
    }

    // Load WOD for a day
    if (!date) return json({ error: 'Missing date' }, 400);

    if (!isCoach) {
      const allowed = await athleteCanViewDate(sess.aid, date);
      if (!allowed) {
        return json({ wod: null, locked: true });
      }
    }

    // Query by canonical local date (unique per day)
    const { data, error } = await supabaseAdmin
      .from('Wod')
      .select(
        'date,title,description,scoring,"timeCap","strengthTitle","strengthDescription","strengthScoreHint","strengthRecordScore","recordMainScore"',
      )
      .eq('date_local', date) // <= key change
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);

    return json({
      wod: data ?? null,
      locked: !isCoach, // athletes: read-only UI
    });
  } catch (e: any) {
    return json({ error: e?.message || 'Failed' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const sess = await verifySession(token);
    if (!sess?.aid) return json({ error: 'Unauthorized' }, 401);

    // Coach only
    const me = await getMe(sess.aid);
    if (!me?.isCoach) return json({ error: 'Forbidden' }, 403);

    const body = await req.json();
    const date: string | undefined = body?.date; // YYYY-MM-DD
    if (!date) return json({ error: 'Missing date' }, 400);

    // Build payload; trigger keeps date_local in sync, but we also set it explicitly
    const row = {
      date: `${date}T00:00:00+02:00`, // any Athens midnight; trigger sets date_local
      date_local: date,               // canonical unique key
      title: body?.title ?? null,
      description: body?.description ?? null,
      scoring: body?.scoring ?? 'for_time',
      timeCap: body?.timeCap ?? null,
      strengthTitle: body?.strengthTitle ?? null,
      strengthDescription: body?.strengthDescription ?? null,
      strengthScoreHint: body?.strengthScoreHint ?? null,
      strengthRecordScore: !!body?.strengthRecordScore,
      recordMainScore: body?.recordMainScore ?? true,
    };

    const { error: upErr } = await supabaseAdmin
      .from('Wod')
      .upsert(row, { onConflict: 'date_local' }); // <= key change
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message || 'Failed' }, 500);
  }
}
