export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

function parseBasicHeader(header: string) {
  if (!header.startsWith('Basic ')) return null;
  try {
    const raw = Buffer.from(header.slice(6), 'base64').toString();
    const idx = raw.indexOf(':');
    if (idx === -1) return null;
    const u = raw.slice(0, idx);
    const p = raw.slice(idx + 1);
    return { u, p, uLen: u.length, pLen: p.length };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const hdr = req.headers.get('authorization') || '';
  const parsed = parseBasicHeader(hdr);

  const expectedUser = process.env.BASIC_USER ?? process.env.stigma ?? '';
  const expectedPass = process.env.BASIC_PASS ?? process.env.stigma_secret ?? '';

  return NextResponse.json({
    hasHeader: Boolean(hdr),
    headerPrefix: hdr.slice(0, 5), // π.χ. "Basic"
    headerLen: hdr.length,
    parsedOk: Boolean(parsed),
    sentUserLen: parsed?.uLen ?? 0,
    sentPassLen: parsed?.pLen ?? 0,
    // συγκρίσεις χωρίς να αποκαλύψουμε τιμές
    userMatch: parsed ? parsed.u === expectedUser : false,
    passMatch: parsed ? parsed.p === expectedPass : false,
    expectedUserLen: expectedUser.length,
    expectedPassLen: expectedPass.length,
  });
}
