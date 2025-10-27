import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // για να μην κάνει cache το Vercel

export async function GET() {
  // Συγκέντρωση βασικών env vars
  const env = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 10) + '...',
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Present' : '❌ Missing',
    SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ? '✅ Present' : '❌ Missing',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };

  // Επιστροφή JSON
  return NextResponse.json({
    ok: true,
    message: 'Environment variables check',
    env,
  });
}
