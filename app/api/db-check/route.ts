import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, message: 'Missing envs', urlExists: !!url, keyExists: !!key },
      { status: 500 }
    );
  }

  // GoTrue (Auth) public settings endpoint – πρέπει να απαντήσει 200 με σωστό apikey
  const resp = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    cache: 'no-store',
  });

  const info = {
    ok: resp.ok,
    status: resp.status,
    statusText: resp.statusText,
  };

  // 200 => OK, 401 => λάθος/μη έγκυρο apikey ή λάθος URL
  return NextResponse.json(info, { status: resp.ok ? 200 : 500 });
}
