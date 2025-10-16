import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase/service';

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

  const { userId, email } = await req.json();
  if (!userId && !email) {
    return NextResponse.json({ error: 'Provide userId or email' }, { status: 400 });
  }

  const supa = supabaseService();

  // Δίνουμε ρόλο 'coach' στο app_metadata.role
  // Αν έχεις userId, προτίμησέ το. Αλλιώς βρες τον χρήστη από email.
  let id = userId;
  if (!id && email) {
    const { data: list, error: listErr } = await supa.auth.admin.listUsers();
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });
    id = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id || '';
    if (!id) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const { data, error } = await supa.auth.admin.updateUserById(id!, {
    app_metadata: { role: 'coach' },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, userId: data.user?.id, role: data.user?.app_metadata?.role });
}
