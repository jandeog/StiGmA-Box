// app/api/wod/dates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

function json(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const sess = await verifySession(token);
    if (!sess?.aid) return json({ error: 'Unauthorized' }, 401);

    // we don’t really need isCoach here; just return which days have a WOD
    const { data, error } = await supabaseAdmin
      .from('Wod')
      .select('date_local')
      .order('date_local', { ascending: true });

    if (error) return json({ error: error.message }, 500);

    const dates = (data ?? [])
      .map((row) => row.date_local as string | null)
      .filter((d): d is string => !!d);

    return json({ dates });
  } catch (e: any) {
    return json({ error: e?.message || 'Failed' }, 500);
  }
}
