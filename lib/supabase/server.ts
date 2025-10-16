import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';
import type { User } from '@supabase/supabase-js';

// Αν τρέχει σε Node runtime, Buffer υπάρχει. Αν κάποτε βάλεις edge runtime, πες μου να το κάνουμε αλλιώς.
function checkBasicAuth(req: Request) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  const raw = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
  const [u, p] = raw.split(':');
  return u === process.env.BASIC_USER && p === process.env.BASIC_PASS;
}

export async function POST(req: Request) {
  if (!checkBasicAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId, email }:{ userId?: string; email?: string } = await req.json();
  if (!userId && !email) {
    return NextResponse.json({ error: 'Provide userId or email' }, { status: 400 });
  }

  const supa = supabaseService();

  let id = userId;

  // Αν δώσεις email, βρίσκουμε το user id (απλό search στην 1η σελίδα)
  if (!id && email) {
    const { data: list, error: listErr } = await supa.auth.admin.listUsers(); // default perPage=50
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

    const match = list.users.find(
      (u: User) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (!match) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    id = match.id;
  }

  const { data, error } = await supa.auth.admin.updateUserById(id!, {
    app_metadata: { role: 'coach' },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    userId: data.user?.id,
    role: data.user?.app_metadata?.role,
  });
}
