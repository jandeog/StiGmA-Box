export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { SESSION_COOKIE, verifySession } from '@/lib/session';
import bcrypt from 'bcryptjs'; // already used elsewhere, ok
import { Buffer } from 'node:buffer';

export async function POST(req: Request) {
  // 1) Auth
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || null;
  const sess = await verifySession(token || undefined).catch(() => null);

  if (!sess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2) Determine which athlete we’re updating
  const url = new URL(req.url);
  const targetId = (url.searchParams.get('id') || '').trim();

  let athleteId: string | null = null;

  if (targetId) {
    // Only coach can upload for someone else
    if (sess.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    athleteId = targetId;
  } else {
    // Self – use session
    athleteId = sess.aid ?? null;
  }

  if (!athleteId) {
    return NextResponse.json({ error: 'Missing athlete id' }, { status: 400 });
  }

  // 3) Read file from multipart/form-data
  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Try to preserve extension if present
  const fileName = (form.get('filename') as string | null) || 'photo';
  const extMatch = fileName.match(/\.(\w+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';

  const path = `${athleteId}.${ext}`;
  const contentType = (file as any).type || 'image/jpeg';

  // 4) Upload to Supabase Storage
  const { error: uploadErr } = await supabaseAdmin.storage
    .from('athlete-photos')
    .upload(path, buffer, {
      upsert: true,
      contentType,
    });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // 5) Get public URL
  const { data: pub } = supabaseAdmin.storage
    .from('athlete-photos')
    .getPublicUrl(path);

  const photoUrl = pub?.publicUrl || null;

  // 6) Save URL in athletes.photo_url
  if (photoUrl) {
    const { error: updErr } = await supabaseAdmin
      .from('athletes')
      .update({ photo_url: photoUrl })
      .eq('id', athleteId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, url: photoUrl });
}
