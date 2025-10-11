export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'ok' : 'missing',
    DIRECT_URL: process.env.DIRECT_URL ? 'ok' : 'missing',
  });
}