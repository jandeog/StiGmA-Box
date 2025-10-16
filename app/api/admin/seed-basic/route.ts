export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import type { User } from '@supabase/supabase-js';

function checkBasicAuth(req: Request) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  const raw = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
  const [u, p] = raw.split(':');
  return u === process.env.BASIC_USER && p === process.env.BASIC_PASS;
}

export async function POST(req: Request) {
  if (!checkBasicAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { athleteEmail }:{ athleteEmail?: string } = await req.json();
  const supa = supabaseService();

  // 1) Αν δόθηκε athleteEmail, βρίσκουμε userId (ή επιστρέφουμε 404)
  let athleteUserId: string | null = null;
  if (athleteEmail) {
    const { data: list, error: listErr } = await supa.auth.admin.listUsers();
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const match = list.users.find(
      (u: User) => u.email?.toLowerCase() === athleteEmail.toLowerCase()
    );
    if (!match) {
      return NextResponse.json({ error: `No user with email ${athleteEmail}` }, { status: 404 });
    }
    athleteUserId = match.id;
  }

  // 2) Δημιουργούμε/εξασφαλίζουμε 1-2 WODs (χθες & σήμερα)
  const today = new Date();
  const d = (offset: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + offset);
    return x.toISOString().slice(0,10); // YYYY-MM-DD
  };

  const wodsPayload = [
    { title: 'WOD Today', description: 'Seed WOD (today)', date: d(0) },
    { title: 'WOD Yesterday', description: 'Seed WOD (yesterday)', date: d(-1) },
  ];

  const upsertWods = await supa
    .from('wods')
    .upsert(wodsPayload, { onConflict: 'date' })
    .select('*')
    .order('date', { ascending: false });

  if (upsertWods.error) {
    return NextResponse.json({ error: upsertWods.error.message, at: 'upsert wods' }, { status: 500 });
  }

  const wodToday = upsertWods.data.find(w => w.date === d(0));
  const wodYesterday = upsertWods.data.find(w => w.date === d(-1));

  // 3) Δημιουργούμε/εξασφαλίζουμε athlete row (αν υπάρχει userId θα τον συνδέσουμε)
  let athleteRow: any = null;

  // Βάζουμε ένα σταθερό όνομα για να μπορούμε να τον ξανατρέχουμε με ασφάλεια
  const athleteName = 'Seed Athlete';
  const getAthlete = await supa
    .from('athletes')
    .select('*')
    .eq('full_name', athleteName)
    .maybeSingle();

  if (getAthlete.error && getAthlete.error.code !== 'PGRST116') {
    return NextResponse.json({ error: getAthlete.error.message, at: 'get athlete' }, { status: 500 });
  }

  if (!getAthlete.data) {
    const ins = await supa
      .from('athletes')
      .insert({ full_name: athleteName, user_id: athleteUserId })
      .select('*')
      .single();
    if (ins.error) return NextResponse.json({ error: ins.error.message, at: 'insert athlete' }, { status: 500 });
    athleteRow = ins.data;
  } else {
    // ενημερώνουμε πιθανό user_id αν δόθηκε
    if (athleteUserId && getAthlete.data.user_id !== athleteUserId) {
      const upd = await supa
        .from('athletes')
        .update({ user_id: athleteUserId })
        .eq('id', getAthlete.data.id)
        .select('*')
        .single();
      if (upd.error) return NextResponse.json({ error: upd.error.message, at: 'update athlete user_id' }, { status: 500 });
      athleteRow = upd.data;
    } else {
      athleteRow = getAthlete.data;
    }
  }

  // 4) Δημιουργούμε 1 score για χθεσινό WOD (για να τεστάρουμε RLS)
  let scoreRow: any = null;
  if (wodYesterday && athleteRow) {
    const existing = await supa
      .from('scores')
      .select('*')
      .eq('athlete_id', athleteRow.id)
      .eq('wod_id', wodYesterday.id)
      .maybeSingle();

    if (existing.error && existing.error.code !== 'PGRST116') {
      return NextResponse.json({ error: existing.error.message, at: 'get score' }, { status: 500 });
    }

    if (!existing.data) {
      const insScore = await supa
        .from('scores')
        .insert({
          athlete_id: athleteRow.id,
          wod_id: wodYesterday.id,
          score: 100,
          unit: 'reps',
          notes: 'seed score',
        })
        .select('*')
        .single();
      if (insScore.error) {
        return NextResponse.json({ error: insScore.error.message, at: 'insert score' }, { status: 500 });
      }
      scoreRow = insScore.data;
    } else {
      scoreRow = existing.data;
    }
  }

  return NextResponse.json({
    ok: true,
    wods: upsertWods.data,
    athlete: athleteRow,
    score: scoreRow,
  });
}
