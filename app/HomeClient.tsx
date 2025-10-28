'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

function parseHashTokens(): { access_token?: string; refresh_token?: string } {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash || '';
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return {
    access_token: params.get('access_token') || undefined,
    refresh_token: params.get('refresh_token') || undefined,
  };
}

export default function ConfirmClient() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getSupabaseBrowser();
  const redirect = params.get('redirect') || '/athletes/add';
  const [msg, setMsg] = useState('Completing sign-in…');

  useEffect(() => {
    const finishSignIn = async () => {
      try {
        // [A] PKCE: ?code=...
        const code = params.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setMsg('Redirecting…');
          setTimeout(() => router.replace(redirect), 350);
          return;
        }

        // [B] Classic magic link: #access_token & #refresh_token στο hash
        const { access_token, refresh_token } = parseHashTokens();
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          // καθάρισε το hash ώστε να μη μείνει στο URL
          if (typeof window !== 'undefined' && window.location.hash) {
            history.replaceState({}, '', window.location.pathname + window.location.search);
          }
          setMsg('Redirecting…');
          setTimeout(() => router.replace(redirect), 350);
          return;
        }

        // [C] Τελικός έλεγχος – ίσως το session είναι ήδη έτοιμο
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          setMsg('Redirecting…');
          setTimeout(() => router.replace(redirect), 350);
          return;
        }

        setMsg('No auth code or tokens found in URL.');
      } catch (err: any) {
        console.error(err);
        setMsg('Sign-in failed: ' + (err?.message || 'unknown error'));
      }
    };
// ✅ Catch "?redirect=..." όταν φτάνεις στην αρχική
useEffect(() => {
  if (typeof window === 'undefined') return;

  const qs = new URLSearchParams(window.location.search);
  const target = qs.get('redirect');
  if (!target) return;

  const go = async () => {
    // δώσε λίγο χρόνο να "δέσει" το session αν μόλις γύρισες από το magic link
    const start = Date.now();
    let { data } = await supabase.auth.getSession();

    while (!data.session && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 150));
      ({ data } = await supabase.auth.getSession());
    }

    if (data.session) {
      router.replace(target);
    } else {
      router.replace(`/auth/confirm?redirect=${encodeURIComponent(target)}`);
    }
  };

  go();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
    finishSignIn();
  }, [router, redirect, supabase, params]);

  return (
    <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
      {msg}
    </div>
  );
}
