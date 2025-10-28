// app/api/auth/send-otp/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body?.email as string | undefined;
    const redirect = (body?.redirect as string | undefined) || '/athletes/add';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const emailRedirectTo = `${origin}/auth/confirm?redirect=${encodeURIComponent(redirect)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, emailRedirectTo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown server error' }, { status: 500 });
  }
}
