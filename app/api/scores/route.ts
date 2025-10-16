import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const supa = await supabaseServer(); // <-- await
  const { data, error } = await supa
    .from('scores')
    .select('id, score, unit, notes, created_at, wod_id, athlete_id')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supa = await supabaseServer(); // <-- await
  const body = await req.json();
  const { data, error } = await supa.from('scores').insert(body).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
