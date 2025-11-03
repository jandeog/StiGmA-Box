import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// GET /api/wod?q=...&date=YYYY-MM-DD
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const date = searchParams.get('date') || '';

  // Αν έχει δοθεί ημερομηνία, φέρε 1 row για αυτήν
  if (date) {
    const { data, error } = await supabaseAdmin
      .from('Wod')
      .select('*')
      .eq('date', new Date(date).toISOString())
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ wod: data });
  }

  // Αλλιώς: search by title/strengthTitle (ilike %q%)
  if (!q) return NextResponse.json({ items: [] });
const like = `%${q}%`;
const { data, error } = await supabaseAdmin
  .from('Wod')
  .select('date, title, description, scoring, timeCap, strengthTitle, strengthDescription, strengthScoreHint')
  .or(`title.ilike.${like},strengthTitle.ilike.${like}`)
  .order('date', { ascending: false })
  .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}

// POST /api/wod  (upsert one day)  — coach only
export async function POST(req: Request) {
  const body = await req.json();

  // Coach check
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess || sess.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Normalize/whitelist payload
  const payload = {
    date: new Date(body.date).toISOString(),
    title: body.title ?? null,
    description: body.description ?? null,
    scoring: body.scoring ?? 'for_time',
    timeCap: body.timeCap ?? null,
    strengthTitle: body.strengthTitle ?? null,
    strengthDescription: body.strengthDescription ?? null,
    strengthScoreHint: body.strengthScoreHint ?? null,
    strengthRecordScore: !!body.strengthRecordScore,
    recordMainScore: body.recordMainScore ?? true,
  };

  const { data, error } = await supabaseAdmin
    .from('Wod')
    .upsert(payload, { onConflict: 'date' })
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, wod: data });
}
