'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

function parseHashTokens(): { access_token?: string; refresh_token?: string } {
  if (typeof window === 'undefined') return {};
  const hash = window.location.hash || '';
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const access_token = params.get('access_token') || undefined;
  const refresh_token = params.get('refresh_token') || undefined;
  return { access_token, refresh_token };
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
        // 1) Αν υπάρχει PKCE code στο query => χρησιμοποίησέ το
        const code = params.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          setMsg('Redirecting…');
          setTimeout(() => router.replace(redirect), 300);
          return;
        }

        // 2) Αλλιώς, δοκίμασε classic magic link: tokens στο #hash
        const { access_token, refresh_token } = parseHashTokens();
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          // καθάρισε το hash από το URL
          if (typeof window !== 'undefined' && window.location.hash) {
            history.replaceState({}, '', window.location.pathname + window.location.search);
          }

          setMsg('Redirecting…');
          setTimeout(() => router.replace(redirect), 300);
          return;
        }

        // 3) Τελικός έλεγχος: ίσως έχει ήδη session (π.χ. auto-refresh)
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          setMsg('Redirecting…');
          setTimeout(() => router.replace(redirect), 300);
          return;
        }

        setMsg('No auth code or tokens found in URL.');
      } catch (err: any) {
        console.error(err);
        setMsg('Sign-in failed: ' + (err?.message || 'unknown error'));
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
