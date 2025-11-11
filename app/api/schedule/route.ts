import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

// ---- GET already exists in your project; keep it as-is if you prefer ----
// Here we keep the same GET you were using so the file is drop-in.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1) If the day already has slots, just return them (no 'enabled' filtering)
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('*')
      .eq('date', date)
      .order('time', { ascending: true });

    if (existErr) throw existErr;
    if ((existing ?? []).length > 0) {
      return NextResponse.json({ items: existing, source: 'slots' });
    }

    // 2) Materialize from template (only enabled rows in the template)
    const dow = new Date(date + 'T00:00:00').getDay();
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('schedule_template')
      .select('*')
      .eq('day_of_week', dow)
      .eq('enabled', true)
      .order('time', { ascending: true });

    if (tplErr) throw tplErr;

    if (!template || template.length === 0) {
      return NextResponse.json({ items: [], msg: 'No template for this day' });
    }

    const newSlots = template.map((t: any) => ({
      date,
      time: t.time,
      title: t.title,
      capacity_main: t.capacity_main,
      capacity_wait: t.capacity_wait,
      // ⚠️ no 'enabled' column in schedule_slots
    }));

    const { error: insertErr } = await supabaseAdmin
      .from('schedule_slots')
      .insert(newSlots);
    if (insertErr) throw insertErr;

    return NextResponse.json({ items: newSlots, source: 'template' });
  } catch (err: any) {
    console.error('schedule GET error', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}


// ----------------------------- POST --------------------------------------
// Saves edits from /schedule/edit
// Payload:
// {
//   mode: 'template' | 'specific',
//   applyAllWeekdays?: boolean,
//   dow?: number,         // 0..6 when mode='template' and not applyAllWeekdays
//   date?: string,        // 'YYYY-MM-DD' when mode='specific'
//   slots: Array<{ time, title, capacity_main, capacity_wait, enabled }>
// }
// Titles can be: 'Rookie / Advanced', 'Competitive', 'Teams', 'Rest' (etc)

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);

  if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (sess.role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden (coach only)' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });

  const { mode, applyAllWeekdays, dow, date, slots } = body as {
    mode: 'template' | 'specific',
    applyAllWeekdays?: boolean,
    dow?: number,
    date?: string,
    slots: Array<{
      time: string;
      title: string;
      capacity_main: number;
      capacity_wait: number;
      enabled: boolean;
    }>;
  };

  try {
    if (mode === 'template') {
      // Replace schedule_template for one DOW or all Mon..Fri
      const days = applyAllWeekdays ? [1, 2, 3, 4, 5] : (typeof dow === 'number' ? [dow] : []);
      if (days.length === 0) {
        return NextResponse.json({ error: 'Missing day_of_week' }, { status: 400 });
      }

      // For each target DOW: delete + insert new rows
      for (const d of days) {
        const { error: delErr } = await supabaseAdmin
          .from('schedule_template')
          .delete()
          .eq('day_of_week', d);
        if (delErr) throw delErr;

        if (slots?.length) {
          const rows = slots.map((s) => ({
            day_of_week: d,
            time: s.time,
            title: s.title,               // e.g. 'Rookie / Advanced'
            capacity_main: s.capacity_main,
            capacity_wait: s.capacity_wait,
            enabled: !!s.enabled,
          }));
          const { error: insErr } = await supabaseAdmin
            .from('schedule_template')
            .insert(rows);
          if (insErr) throw insErr;
        }
      }

      return NextResponse.json({ ok: true, mode: 'template', days });
    }

    if (mode === 'specific') {
      if (!date) {
        return NextResponse.json({ error: 'Missing date' }, { status: 400 });
      }

      // Replace schedule_slots for the specific date
const { error: delErr } = await supabaseAdmin
  .from('schedule_slots')
  .delete()
  .eq('date', date);
if (delErr) throw delErr;

if (slots?.length) {
  const rows = slots.map((s: any) => ({
    date,
    time: s.time,
    title: s.title,
    capacity_main: Number(s.capacity_main),
    capacity_wait: Number(s.capacity_wait),
    // ⚠️ no 'enabled' here
  }));
  const { error: insErr } = await supabaseAdmin.from('schedule_slots').insert(rows);
  if (insErr) throw insErr;
}


      return NextResponse.json({ ok: true, mode: 'specific', date });
    }

    return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
  } catch (err: any) {
    console.error('💥 schedule POST error', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
