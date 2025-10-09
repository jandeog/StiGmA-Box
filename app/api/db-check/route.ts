export const dynamic = 'force-dynamic'; // για να μην κάνει cache το Vercel

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'ok' : 'missing',
    DIRECT_URL: process.env.DIRECT_URL ? 'ok' : 'missing',
    NODE_ENV: process.env.NODE_ENV,
  });
}