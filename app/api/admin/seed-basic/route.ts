export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

// Μικρο-τύποι για να αποφύγουμε imports από '@supabase/supabase-js'
type SBUser = { id: string; email?: string | null };
type WodRow = { id: string; title: string; description?: string | null; date: string };
type AthleteRow = { id: string; full_name: string; user_id: string | null };

function checkBasicAuth(req: Request) {
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  const raw = Buffer.from(h.slice(6), 'base64').toString();
  const idx = raw.indexOf(':'); if (idx === -1) return false;
  const u = raw.slice(0, idx), p = raw.slice(idx + 1);
  const eu = process.env.BASIC_USER ?? process.env.stigma ?? '';
  const ep = process.env.BASIC_PASS ?? process.env.stigma_secret ?? '';
  return u === eu && p === ep;
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function seedCore(athleteEmail?: string) {
  const supa = supabaseService();
  const out: any = { ok: true, steps: [] as string[] };

  try {
    // 0) optional resolve userId από email
    out.steps.push('resolve userId');
    let athleteUserId: string | null = null;
    if (athleteEmail) {
      const { data: list, error: listErr } = await supa.auth.admin.listUsers();
      if (listErr) throw new Error('listUsers: ' + listErr.message);
      const match = (list.users as SBUser[]).find(
        (u) => u.email?.toLowerCase() === athleteEmail.toLowerCase()
      );
      if (!match) throw new Error(`No user with email ${athleteEmail}`);
      athleteUserId = match.id;
    }
    out.athleteUserId = athleteUserId;

    // 1) upsert 2 WODs (σήμερα & χθες)
    out.steps.push('upsert wods');
    const today = new Date();
    const d0 = ymd(today);
    const d_1 = ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
    const wodsPayload: Pick<WodRow, 'title' | 'description' | 'date'>[] = [
      { title: 'WOD Today', description: 'Seed WOD (today)', date: d0 },
      { title: 'WOD Yesterday', description: 'Seed WOD (yesterday)', date: d_1 },
    ];
    const up = await supa.from('wods').upsert(wodsPayload, { onConflict: 'date' }).select('*');
    if (up.error) throw new Error('upsert wods: ' + up.error.message);
    const wods = (up.data ?? []) as WodRow[];
    out.wods = wods;
    const wodYesterday = wods.find((w: WodRow) => w.date === d_1);

    // 2) ensure athlete "Seed Athlete"
    out.steps.push('ensure athlete');
    const name = 'Seed Athlete';
    const got = await supa.from('athletes').select('*').eq('full_name', name).maybeSingle();
    if (got.error && got.error.code !== 'PGRST116') throw new Error('get athlete: ' + got.error.message);

    let athlete = got.data as AthleteRow | null;
    if (!athlete) {
      const ins = await supa
        .from('athletes')
        .insert({ full_name: name, user_id: athleteUserId })
        .select('*')
        .single();
      if (ins.error) throw new Error('insert athlete: ' + ins.error.message);
      athlete = ins.data as AthleteRow;
    } else if (athleteUserId && athlete.user_id !== athleteUserId) {
      const upd = await supa
        .from('athletes')
        .update({ user_id: athleteUserId })
        .eq('id', athlete.id)
        .select('*')
        .single();
      if (upd.error) throw new Error('update athlete user_id: ' + upd.error.message);
      athlete = upd.data as AthleteRow;
    }
    out.athlete = athlete;

    // 3) ensure 1 score για χθες
    out.steps.push('ensure score');
    if (wodYesterday && athlete) {
      const ex = await supa
        .from('scores')
        .select('*')
        .eq('athlete_id', athlete.id)
        .eq('wod_id', wodYesterday.id)
        .maybeSingle();
      if (ex.error && ex.error.code !== 'PGRST116') throw new Error('get score: ' + ex.error.message);

      if (!ex.data) {
        const insS = await supa
          .from('scores')
          .insert({
            athlete_id: athlete.id,
            wod_id: wodYesterday.id,
            score: 100,
            unit: 'reps',
            notes: 'seed score',
          })
          .select('*')
          .single();
        if (insS.error) throw new Error('insert score: ' + insS.error.message);
        out.score = insS.data;
      } else {
        out.score = ex.data;
      }
    }

    return NextResponse.json(out);
  } catch (e: any) {
    out.ok = false;
    out.error = e?.message || String(e);
    out.failedAt = out.steps[out.steps.length - 1] ?? 'start';
    return NextResponse.json(out, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!checkBasicAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { athleteEmail?: string };
  return seedCore(body.athleteEmail);
}

export async function GET(req: Request) {
  if (!checkBasicAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const u = new URL(req.url);
  const athleteEmail = u.searchParams.get('athleteEmail') || undefined;
  return seedCore(athleteEmail);
}
