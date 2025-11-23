// app/api/schedule/populate/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Minimal hardening; logic unchanged: reads today's template by DOW and inserts into schedule_slots for today
export async function POST() {
  try {
    const today = new Date();
    const dateIso = today.toISOString().split('T')[0];

    // Sunday = 0 .. Saturday = 6 (keep same as your code)
    const dow = today.getDay();

// 🔒 Sunday is always a rest day for auto-population
if (dow === 0) {
  return NextResponse.json({
    ok: true,
    inserted: 0,
    note: 'Sunday is a rest day (no auto-populate from template).',
  });
}

    // Load today's template
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('schedule_template')
      .select('time, title, capacity_main, capacity_wait')
      .eq('day_of_week', dow)
      .eq('enabled', true);

    if (tplErr) throw tplErr;

    // If nothing enabled today, no-op
    if (!template || template.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, note: 'No enabled template for today' });
    }

    // Avoid duplicates for today (unique date+time constraint recommended)
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('time')
      .eq('date', dateIso);

    if (existErr) throw existErr;
    const already = new Set((existing ?? []).map(r => r.time));

    const slots = template
      .filter(t => !already.has(t.time))
      .map(t => ({
        date: dateIso,
        time: t.time,
        title: t.title,
        capacity_main: t.capacity_main,
        capacity_wait: t.capacity_wait,
      }));

    if (slots.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, note: 'Already populated for today' });
    }

    const { error } = await supabaseAdmin.from('schedule_slots').insert(slots);
    if (error) throw error;

    return NextResponse.json({ ok: true, inserted: slots.length });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
