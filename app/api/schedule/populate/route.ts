import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
  try {
    const today = new Date();
    const dateIso = today.toISOString().split('T')[0];
    const dow = today.getDay();

    // Load today's template
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('schedule_template')
      .select('*')
      .eq('day_of_week', dow)
      .eq('enabled', true);

    if (tplErr) throw tplErr;
    if (!template || template.length === 0) {
      return NextResponse.json({ ok: false, msg: 'No template for today' });
    }

    // Check if already populated
    const { data: existing } = await supabaseAdmin
      .from('schedule_slots')
      .select('id')
      .eq('date', dateIso);

    if (existing && existing.length > 0) {
      return NextResponse.json({ ok: true, msg: 'Already populated' });
    }

    // Insert slots for today
    const slots = template.map((t) => ({
      date: dateIso,
      time: t.time,
      title: t.title,
      capacity_main: t.capacity_main,
      capacity_wait: t.capacity_wait,
    }));

    const { error } = await supabaseAdmin.from('schedule_slots').insert(slots);
    if (error) throw error;

    return NextResponse.json({ ok: true, inserted: slots.length });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
