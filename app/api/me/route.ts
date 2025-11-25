// app/api/me/route.ts
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;

  const sess = await verifySession(token || undefined).catch(() => null);
  if (!sess?.aid) {
    const res = NextResponse.json({ me: null }, { status: 200 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  const { data, error } = await supabaseAdmin
    .from('athletes')
    .select(`
      id, email,
      first_name, last_name, nickname, team_name,
      dob, phone, gender,
      height_cm, weight_kg, years_of_experience,
      notes, credits, is_coach,
      terms_version, terms_accepted_at,
      emergency_name, emergency_phone, photo_url,
      last_credits_update
    `)
    .eq('id', sess.aid)
    .maybeSingle();

  if (error) {
    const res = NextResponse.json({ me: null, error: error.message }, { status: 500 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (!data) {
    const res = NextResponse.json({ me: null }, { status: 404 });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // ---- Credits expiration & warning logic ----
  let creditsWarning: { days_left: number; will_reset_at: string } | null = null;

  const lastUpdateRaw = (data as any).last_credits_update as string | null;
  const currentCredits = typeof data.credits === 'number' ? data.credits : 0;

  if (lastUpdateRaw && currentCredits > 0) {
    const last = new Date(lastUpdateRaw);
    if (!Number.isNaN(last.getTime())) {
      const resetAt = new Date(last.getTime());
      resetAt.setMonth(resetAt.getMonth() + 1); // +1 month from last renewal

      const now = new Date();

      if (now >= resetAt) {
        // Month passed → reset credits to 0 (once, lazily when the user opens the app)
        try {
          const { data: upd, error: updErr } = await supabaseAdmin
            .from('athletes')
            .update({ credits: 0 })
            .eq('id', sess.aid)
            .select('credits')
            .maybeSingle();

          if (!updErr && upd) {
            (data as any).credits = upd.credits;
          } else {
            (data as any).credits = 0;
          }
        } catch {
          (data as any).credits = 0;
        }
      } else {
        const msLeft = resetAt.getTime() - now.getTime();
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

        if (daysLeft <= 3) {
          creditsWarning = {
            days_left: daysLeft,
            will_reset_at: resetAt.toISOString(),
          };
        }
      }
    }
  }

  const payload: any = {
    ...data,
    credits_warning: creditsWarning,
  };

  const res = NextResponse.json({ me: payload }, { status: 200 });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
