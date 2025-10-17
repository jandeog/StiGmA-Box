export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

function checkBasicAuth(req: Request) {
  const h = req.headers.get('authorization') || '';
  if (!h.startsWith('Basic ')) return false;
  const raw = Buffer.from(h.slice(6), 'base64').toString();
  const i = raw.indexOf(':'); if (i === -1) return false;
  const u = raw.slice(0, i), p = raw.slice(i + 1);
  const eu = process.env.BASIC_USER ?? process.env.stigma ?? '';
  const ep = process.env.BASIC_PASS ?? process.env.stigma_secret ?? '';
  return u === eu && p === ep;
}

export async function GET(req: Request) {
  if (!checkBasicAuth(req)) return NextResponse.json({ ok:false, error:'Unauthorized' }, { status:401 });
  const out: any = { ok: true, steps: [] };
  try {
    out.steps.push('create service client');
    const supa = supabaseService();

    out.steps.push('auth.admin.listUsers');
    const { data: list, error: listErr } = await supa.auth.admin.listUsers();
    if (listErr) throw new Error('listUsers: ' + listErr.message);
    out.usersCount = list?.users?.length ?? 0;

    out.steps.push('select from wods (limit 1)');
    const sel = await supa.from('wods').select('*').limit(1);
    if (sel.error) throw new Error('select wods: ' + sel.error.message);
    out.wodsCount = sel.data?.length ?? 0;

    out.steps.push('select from athletes (limit 1)');
    const selA = await supa.from('athletes').select('*').limit(1);
    if (selA.error) throw new Error('select athletes: ' + selA.error.message);
    out.athletesCount = selA.data?.length ?? 0;

    return NextResponse.json(out);
  } catch (e:any) {
    out.ok = false;
    out.error = e?.message || String(e);
    out.failedAt = out.steps?.[out.steps.length - 1];
    return NextResponse.json(out, { status: 500 });
  }
}
