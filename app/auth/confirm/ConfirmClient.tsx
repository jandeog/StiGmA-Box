// app/auth/confirm/ConfirmClient.tsx (Client Component)
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '../../../lib/supabaseClient';

export default function ConfirmClient() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getSupabaseBrowser();
  const redirect = params.get('redirect') || '/athletes/add';

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        if (typeof window !== 'undefined' && window.location.hash) {
          history.replaceState({}, '', window.location.pathname + window.location.search);
        }
        router.replace(redirect);
      }
    });

    // Αν το session υπάρχει ήδη πριν κάνουμε subscribe
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirect);
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, [router, redirect, supabase]);

  return (
    <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
      Completing sign-in…
    </div>
  );
}
