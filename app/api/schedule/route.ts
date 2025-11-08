// app/api/schedule/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 });

  // ✅ Verify session
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // 1️⃣ Έλεγχος αν υπάρχουν ήδη slots για αυτή την ημερομηνία
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('schedule_slots')
      .select('*')
      .eq('date', date)
      .order('time', { ascending: true });

    if (existErr) throw existErr;

    if (existing && existing.length > 0) {
      return NextResponse.json({ items: existing });
    }

    // 2️⃣ Αν δεν υπάρχουν, φόρτωσε το template ανάλογα με τη μέρα της εβδομάδας
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

    // 3️⃣ Δημιούργησε slots από το template
    const newSlots = template.map((t) => ({
      date,
      time: t.time,
      title: t.title,
      capacity_main: t.capacity_main,
      capacity_wait: t.capacity_wait,
    }));

    // 4️⃣ Κάνε insert στη schedule_slots
    const { error: insertErr } = await supabaseAdmin
      .from('schedule_slots')
      .insert(newSlots);

    if (insertErr) throw insertErr;

    // Επιστροφή των νέων slots στο frontend
    return NextResponse.json({ items: newSlots, msg: 'Auto-populated from template' });
  } catch (err: any) {
    console.error('💥 schedule error', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
