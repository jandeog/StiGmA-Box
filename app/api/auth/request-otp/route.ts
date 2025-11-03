import { NextResponse } from 'next/server';
import { supabaseAnon } from '@/lib/supabaseAnon';

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const { error } = await supabaseAnon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sent: true });
}
