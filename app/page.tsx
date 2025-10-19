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

const getSiteUrl = () => {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

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

type Step = 'email' | 'password' | 'otp';

function AuthLandingInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [step, setStep] = useState<Step>('email');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // OTP state
  const [otp, setOtp] = useState('');
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Αν υπάρχει ήδη session, κάνε reroute
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!mounted) return;

      if (hasSession && sp.get('new') === '1') {
        router.replace('/athletes/add');
        return;
      }
      if (hasSession) {
        router.replace('/schedule');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router, sp]);

  // ----- guards -----
  const canEmail = useMemo(() => /\S+@\S+\.\S+/.test(email) && !busy, [email, busy]);
  const canPassword = useMemo(
    () => email.trim().length > 3 && password.trim().length >= 6 && !busy,
    [email, password, busy]
  );
  const canVerify = useMemo(
    () => email.trim().length > 3 && /^\d{6}$/.test(otp) && !busy,
    [email, otp, busy]
  );

  // ----- flows -----
  // Server-side lookup: does email exist?
  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/email-exists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Lookup failed');

      if (json.exists) {
        setStep('password');
      } else {
        // Νέος χρήστης: ξεκινάμε OTP (signup)
        await startOtpFlow();
      }
    } catch (err: any) {
      setMsg(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  // Create account / Send OTP (signup-or-login via code)
  const startOtpFlow = async () => {
    if (!supabase) return false;

    // Σημαδεύουμε ότι πρόκειται για νέα εγγραφή
    const url = new URL(window.location.href);
    url.searchParams.set('new', '1');
    window.history.replaceState(null, '', url.toString());

    const emailRedirectTo = `${getSiteUrl()}/auth/callback?new=1`;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo, // fallback αν πατήσει verify link
      },
    });

    if (error) {
      setMsg(error.message || 'Could not send verification code.');
      return false;
    }
    setMsg('Στείλαμε 6-ψήφιο κωδικό στο email σου. Πληκτρολόγησέ τον παρακάτω.');
    setStep('otp');
    return true;
  };

  // Try password sign-in
  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (!error && data.session) {
      router.replace('/schedule');
      setBusy(false);
      return;
    }

    setMsg(
      'Invalid email or password. Αν δεν έχεις λογαριασμό ή ξέχασες το password, χρησιμοποίησε τις επιλογές από κάτω.'
    );
    setBusy(false);
  };

  // Forgot password → send reset email
  const onForgotPassword = async () => {
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    const redirectTo = `${getSiteUrl()}/auth/reset`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) {
      setMsg(error.message || 'Could not send reset email.');
    } else {
      setMsg('Σου στείλαμε email για αλλαγή password. Άνοιξέ το και ακολούθησε το link.');
    }
    setBusy(false);
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email', // 6-digit email OTP
    });

    if (error || !data.session) {
      setMsg(error?.message || 'Λάθος ή ληγμένος κωδικός.');
      setBusy(false);
      return;
    }

    if (sp.get('new') === '1') {
      router.replace('/athletes/add');
    } else {
      router.replace('/schedule');
    }
    setBusy(false);
  };

  const onResend = async () => {
    if (!email || !supabase) return;
    setResendMsg(null);
    setBusy(true);
    const emailRedirectTo = `${getSiteUrl()}/auth/callback?new=1`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    if (error) {
      setResendMsg(error.message || 'Could not resend code.');
    } else {
      setResendMsg('Στείλαμε ξανά τον κωδικό στο email σου.');
    }
    setBusy(false);
  };

  // ----- UI -----
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
        </div>

        {step === 'email' && (
          <form onSubmit={onEmailSubmit} className="space-y-3">
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

            {msg && <div className="text-sm mt-1 text-zinc-200">{msg}</div>}

            <button
              className="w-full mt-2 px-4 py-2 rounded border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm disabled:opacity-50"
              type="submit"
              disabled={!canEmail}
            >
              Continue
            </button>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={startOtpFlow}
                disabled={!canEmail || busy}
                className="text-sm underline underline-offset-4 text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
              >
                Create account / Send code
              </button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={onPasswordSubmit} className="space-y-3">
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 opacity-70"
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
              disabled={!canPassword}
            >
              Sign in
            </button>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-xs underline underline-offset-4 text-zinc-400 hover:text-zinc-300"
              >
                Back
              </button>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onForgotPassword}
                  className="text-xs underline underline-offset-4 text-emerald-300 hover:text-emerald-200"
                  disabled={busy}
                >
                  Forgot password
                </button>
                <button
                  type="button"
                  onClick={startOtpFlow}
                  className="text-xs underline underline-offset-4 text-emerald-300 hover:text-emerald-200"
                  disabled={busy}
                >
                  Create account / Send code
                </button>
              </div>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={onVerifyOtp} className="space-y-3">
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 opacity-70"
              />
            </div>
            <div>
              <label className="block text-sm mb-1 text-zinc-300">6-digit code</label>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onPaste={(e) => {
                  const text = e.clipboardData.getData('text') || '';
                  const clean = text.replace(/\D/g, '').slice(0, 6);
                  if (clean) {
                    e.preventDefault();
                    setOtp(clean);
                  }
                }}
                className="tracking-widest text-center text-lg w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                placeholder="••••••"
                required
              />
            </div>

            {msg && <div className="text-sm mt-1 text-zinc-200">{msg}</div>}
            {resendMsg && <div className="text-sm mt-1 text-zinc-300">{resendMsg}</div>}

            <button
              className="w-full mt-2 px-4 py-2 rounded border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm disabled:opacity-50"
              type="submit"
              disabled={!canVerify}
            >
              Verify code
            </button>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('email')}
                className="text-xs underline underline-offset-4 text-zinc-400 hover:text-zinc-300"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onResend}
                className="text-xs underline underline-offset-4 text-emerald-300 hover:text-emerald-200"
                disabled={busy}
              >
                Resend code
              </button>
            </div>

            <div className="text-xs text-zinc-500 mt-2 leading-relaxed">
              Μετά την επιβεβαίωση θα πας στο{' '}
              <span className="font-mono">{sp.get('new') === '1' ? '/athletes/add' : '/schedule'}</span>.
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
