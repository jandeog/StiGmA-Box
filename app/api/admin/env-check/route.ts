export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

export async function GET() {
  const u = process.env.BASIC_USER ?? process.env.stigma;
  const p = process.env.BASIC_PASS ?? process.env.stigma_secret;

  return NextResponse.json({
    ok: Boolean(u && p),
    hasUser: Boolean(u),
    hasPass: Boolean(p),
    userLen: u ? u.length : 0,
    passLen: p ? p.length : 0,
    // δεν δείχνουμε ποτέ τις τιμές
  });
}
