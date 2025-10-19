// app/api/auth/email-exists/route.ts
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // SERVER-ONLY

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }
    const ok = /\S+@\S+\.\S+/.test(email);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // GoTrue Admin REST: GET /auth/v1/admin/users?email=<email>
    const url = new URL('/auth/v1/admin/users', SUPABASE_URL);
    url.searchParams.set('email', email);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      // Vercel/Edge sometimes requires this for internal fetches
      cache: 'no-store',
    });

    if (!res.ok) {
      // 404 = not found (no such user) => exists: false
      if (res.status === 404) {
        return NextResponse.json({ exists: false });
      }
      const text = await res.text().catch(() => '');
      return NextResponse.json({ error: text || 'Lookup failed' }, { status: 500 });
    }

    const data = await res.json().catch(() => null);
    // Αν επιστρέψει user object ή λίστα με results:
    // GoTrue μπορεί να επιστρέψει { users: [...] } ή single user, ανάλογα με version.
    const exists =
      !!data &&
      ((Array.isArray(data.users) && data.users.length > 0) ||
        (data.id && data.email)); // single user payload

    return NextResponse.json({ exists: !!exists });
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
