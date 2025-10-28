'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

export default function HomeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getSupabaseBrowser();

  useEffect(() => {
    // Αν υπάρχει redirect ή access_token στο hash, στείλε στο /auth/confirm
    if (typeof window === 'undefined') return;
    const hasToken = window.location.hash.includes('access_token=');
    const target = params.get('redirect');
    if (hasToken || target) {
      const next = target || '/athletes/add';
      router.replace(`/auth/confirm?redirect=${encodeURIComponent(next)}`);
    }
  }, [router, params]);

  // --- εδώ αφήνεις το υπόλοιπο login/signup UI σου ---
  return (
    <main className="min-h-screen grid place-items-center text-zinc-300">
      <div className="space-y-6 text-center">
        <h1 className="text-3xl font-bold">Welcome to StiGmA-Box</h1>
        <p className="text-zinc-400 text-sm">
          Sign in or request a magic link to continue.
        </p>
        {/* Εδώ μένει όλο το υπάρχον login component σου */}
      </div>
    </main>
  );
}
