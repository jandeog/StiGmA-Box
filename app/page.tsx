'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';

const supabase =
  typeof window !== 'undefined'
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : (null as any);

// ---------- Page wrapper with Suspense ----------
export default function Page() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <AuthLandingInner />
    </Suspense>
  );
}

function LoadingShell() {
  return (
    <section className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-900 rounded-2xl p-6 shadow">
        <div className="flex flex-col items-center mb-2">
          <div className="w-24 h-24 rounded-full border border-zinc-700 animate-pulse" />
          <p className="mt-4 text-sm text-zinc-400">Loading…</p>
        </div>
      </div>
    </section>
  );
}

// ---------- Inner client that uses useSearchParams ----------
function AuthLandingInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Αν υπάρχει ήδη session, κάνε reroute
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (hasSession && sp.get('new') === '1') {
        if (mounted) router.replace('/athletes/add');
        return;
      }
      if (hasSession) {
        if (mounted) router.replace('/schedule');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, sp]);

  const canSubmit = useMemo(
    () => email.trim().length > 3 && password.trim().length >= 6 && !busy,
    [email, password, busy]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);

    const em = email.trim();
    const pw = password;

    // 1) Προσπάθεια sign-in
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: em, password: pw });

    if (!signInError && signInData.session) {
      router.replace('/schedule');
      setBusy(false);
      return;
    }

    // 2) Αν αποτύχει, προχώρα σε sign-up με verification email
    const redirectTo = `${window.location.origin}/?new=1`;

    const { error: signUpError } = await supabase.auth.signUp({
      email: em,
      password: pw,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (signUpError) {
      setMsg(
        signUpError.message ||
          'Could not sign up. If you already have an account, check your password or reset it.'
      );
      setBusy(false);
      return;
    }

    setMsg(
      'Check your email to confirm your account. After confirming, you will be redirected to complete your athlete profile.'
    );
    setBusy(false);
  };

  return (
    <section className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-900 rounded-2xl p-6 shadow">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/images/Stigma-Logo-white-650x705.png"
            alt="Stigma Logo"
            width={180}
            height={180}
            priority
            className="w-32 sm:w-40 md:w-44 h-auto mx-auto"
          />
          <h1 className="mt-3 text-xl font-semibold">Welcome</h1>
          <p className="text-sm text-zinc-400">Sign in or sign up with email & password</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              placeholder="you@example.com"
              autoFocus
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Password</label>
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {msg && <div className="text-sm mt-1 text-zinc-200">{msg}</div>}

          <button
            className="w-full mt-2 px-4 py-2 rounded border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm disabled:opacity-50"
            type="submit"
            disabled={!canSubmit}
          >
            {busy ? 'Working…' : 'Sign in / Sign up'}
          </button>

          <div className="text-xs text-zinc-500 mt-2 leading-relaxed">
            If you don’t have an account, we’ll create one and email you a confirmation link. After
            confirming, you’ll be taken to <span className="font-mono">/athletes/add</span> to
            complete your profile. Otherwise, you’ll go to <span className="font-mono">/schedule</span>.
          </div>
        </form>
      </div>
    </section>
  );
}
