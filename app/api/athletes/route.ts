import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  const supa = supabaseServer();
  const { data, error } = await supa.from('athletes').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supa = supabaseServer(); // RLS θα επιτρέψει μόνο admin/coach
  const body = await req.json();
  const { data, error } = await supa.from('athletes').insert(body).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
