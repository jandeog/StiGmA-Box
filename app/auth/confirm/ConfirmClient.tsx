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
        // 🔹 1. Πάρε το auth code από το URL
        const code = params.get('code');
        if (!code) {
          setMsg('No auth code found in URL.');
          return;
        }

        // 🔹 2. Αντάλλαξε το code με session
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error(error);
          setMsg('Sign-in failed: ' + error.message);
          return;
        }

        // 🔹 3. Αν υπάρχει session → redirect
        if (data?.session) {
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
  }, [router, redirect, supabase, params]);

  return (
    <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
      {msg}
    </div>
  );
}
