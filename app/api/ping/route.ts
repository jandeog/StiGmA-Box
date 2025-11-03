export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin.from('athletes').select('id').limit(1);
  return NextResponse.json({
    ok: !error,
    error: error?.message || null,
    urlLen: (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').length,
    srLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
  });
}
