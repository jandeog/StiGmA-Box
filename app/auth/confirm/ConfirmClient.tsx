'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

export default function ConfirmClient() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getSupabaseBrowser();
  const redirect = params.get('redirect') || '/athletes/add';
  const [msg, setMsg] = useState('Completing sign-in…');

  useEffect(() => {
    const finishSignIn = async () => {
      try {
        // ✅ Ελέγχει αν υπάρχουν tokens στο hash (classic magic link)
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
          // @ts-ignore - exists in runtime
          await supabase.auth.getSessionFromUrl({ storeSession: true });
          history.replaceState({}, '', window.location.pathname + window.location.search);
        }

        const { data } = await supabase.auth.getSession();

        if (data.session) {
          setMsg('Redirecting…');
          setTimeout(() => router.replace(redirect), 400);
        } else {
          setMsg('Could not complete sign-in. Please try again.');
        }
      } catch (err: any) {
        console.error(err);
        setMsg('Sign-in failed: ' + err.message);
      }
    };

    finishSignIn();
  }, [router, redirect, supabase]);

  return (
    <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
      {msg}
    </div>
  );
}
