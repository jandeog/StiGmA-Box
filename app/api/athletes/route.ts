// app/api/athletes/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10)));

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const sess = await verifySession(token);
  if (!sess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // NOTE: We allow both roles to read the list. If you want to hide the list from athletes,
  // change this to: if (sess.role !== 'coach') { ...only return their own row... }
  let query = supabaseAdmin
    .from('athletes')
    .select(`
  id, email, first_name, last_name, nickname, team_name, phone,
  credits, is_coach, created_at, updated_at,
  emergency_name, emergency_phone
    `);

  if (q) {
    // case-insensitive contains across a few fields
    const like = `%${q}%`;
    query = query.or(
      [
        `email.ilike.${like}`,
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
        `nickname.ilike.${like}`,
        `team_name.ilike.${like}`,
      ].join(',')
    );
  }

  const { data, error } = await query
    .order('is_coach', { ascending: false })
    .order('last_name', { ascending: true, nullsFirst: true })
    .order('first_name', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
