export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function GET() {
  const raw =
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  let host = '';
  try { host = new URL(raw).host; } catch {}
  return NextResponse.json({
    ok: !!raw,
    host,               // e.g. abcd.supabase.co
    urlLen: raw.length,
    srLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().length,
  });
}
