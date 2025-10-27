'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

export default function AuthConfirmPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getSupabaseBrowser();
  const redirect = params.get('redirect') || '/athletes/add';

  useEffect(() => {
    let unsub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        // καθάρισε το #access_token από το URL για να μείνει καθαρό
        if (typeof window !== 'undefined' && window.location.hash) {
          history.replaceState({}, '', window.location.pathname + window.location.search);
        }
        router.replace(redirect);
      }
    }).data.subscription;

    const finishFromUrl = async () => {
      // Αν το magic link έφερε tokens στο #hash, αποθήκευσέ τα ως session
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
        try {
          // v2 API – αν υπάρχει, αποθηκεύει το session και πυροδοτεί SIGNED_IN
          // @ts-ignore (αν λείπουν types στη δική σου έκδοση)
          await supabase.auth.getSessionFromUrl({ storeSession: true });
        } catch { /* ignore */ }
      }
      // Fallback: αν έχει ήδη στηθεί session, φύγε κατευθείαν
      const { data: s } = await supabase.auth.getSession();
      if (s.session) router.replace(redirect);
    };

    finishFromUrl();
    return () => unsub?.unsubscribe();
  }, [router, redirect, supabase]);

  return (
    <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
      Completing sign‑in…
    </div>
  );
}
