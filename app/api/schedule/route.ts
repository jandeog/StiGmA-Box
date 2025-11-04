// app/api/schedule/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get('date') || ''; // expects "YYYY-MM-DD"

  if (!date) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Base query for schedule slots
  let query = supabaseAdmin
    .from('schedule_slots')
    .select(`
      id, date, time, title,
      capacity_main, capacity_wait
    `)
    .eq('date', date)
    .order('time', { ascending: true });

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
