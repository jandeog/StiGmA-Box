import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirectTo = url.searchParams.get('redirect') || '/athletes/add';
  return NextResponse.redirect(redirectTo);
}
