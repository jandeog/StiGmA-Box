'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function AuthLandingPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 1) Αν υπάρχει session, αποφασίζουμε πού πάμε
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      // Αν έχουμε session κι έχουμε επιστρέψει από signup (new=1) => πάμε /athletes/add
      if (hasSession && sp.get('new') === '1') {
        if (mounted) router.replace('/athletes/add');
        return;
      }

      // Αλλιώς, απλώς logged in => /schedule
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

    // 2) Πρώτα δοκιμάζουμε sign-in
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: em, password: pw });

    if (!signInError && signInData.session) {
      // Επιτυχία -> /schedule
      router.replace('/schedule');
      setBusy(false);
      return;
    }

    // 3) Αν αποτύχει το sign-in, ξεκινάμε sign-up (με confirm email)
    //    Redirect πίσω στο /?new=1 ώστε μετά την επιβεβαίωση να πάει /athletes/add
    const redirectTo = `${window.location.origin}/?new=1`;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: em,
      password: pw,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (signUpError) {
      // Γνωστά cases: user already registered, weak password, κλπ.
      setMsg(
        signUpError.message ||
          'Could not sign up. If you already have an account, check your password or reset it.'
      );
      setBusy(false);
      return;
    }

    // 4) Αν δεν έχει error, το Supabase έστειλε verification email.
    //    Δείχνουμε οδηγία — όταν επιβεβαιώσει, ο χρήστης θα επιστρέψει στο /?new=1
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
            complete your profile. Otherwise, we’ll take you straight to{' '}
            <span className="font-mono">/schedule</span>.
          </div>
        </form>
      </div>
    </section>
  );
}
