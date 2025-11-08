// app/api/schedule/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const date = dateParam || new Date().toISOString().split('T')[0]; // default today

    // ✅ 1. Verify session
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const sess = await verifySession(token);
    if (!sess)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ✅ 2. Fetch slots for date
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('*')
      .eq('date', date)
      .order('time', { ascending: true });

    if (existErr) throw existErr;

    // If found → return them
    if (existing?.length) {
      return NextResponse.json({ items: existing, msg: 'Loaded from schedule_slots' });
    }

    // ✅ 3. Otherwise load from template
    const dow = new Date(date + 'T00:00:00').getDay();
    const { data: template, error: tplErr } = await supabaseAdmin
      .from('schedule_template')
      .select('*')
      .eq('day_of_week', dow)
      .eq('enabled', true)
      .order('time', { ascending: true });

    if (tplErr) throw tplErr;

    if (!template?.length) {
      return NextResponse.json({ items: [], msg: 'No template for this day' });
    }

    // ✅ 4. Insert new slots derived from template
    const newSlots = template.map((t) => ({
      date,
      time: t.time,
      title: t.title,
      capacity_main: t.capacity_main,
      capacity_wait: t.capacity_wait,
    }));

    const { error: insertErr } = await supabaseAdmin
      .from('schedule_slots')
      .insert(newSlots);
    if (insertErr) throw insertErr;

    return NextResponse.json({
      items: newSlots,
      msg: 'Auto-populated from template',
    });
  } catch (err: any) {
    console.error('💥 schedule error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error' },
      { status: 500 }
    );
  }
}
