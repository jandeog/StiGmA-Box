export const runtime = 'nodejs';

import { NextResponse } from 'next/server';

function checkBasicAuth(req: Request) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  const raw = Buffer.from(header.replace('Basic ', ''), 'base64').toString();
  const [u, p] = raw.split(':');
  return u === process.env.BASIC_USER && p === process.env.BASIC_PASS;
}

export async function GET(req: Request) {
  if (!checkBasicAuth(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, msg: 'admin ok' });
}
