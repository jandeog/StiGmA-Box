'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const getSiteUrl = () => {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

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

  const [sessionChecked, setSessionChecked] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ✔️ πιο σταθερός έλεγχος session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (session?.user?.email) {
          setSignedInEmail(session.user.email);
        } else {
          setSignedInEmail(null);
        }
      } catch (err) {
        console.warn('Session check error', err);
        setSignedInEmail(null);
      } finally {
        setSessionChecked(true);
      }
    };
    checkSession();
  }, []);


  // ➤ Νέα έκδοση routePostAuth: ελέγχει με email και user_id
  const routePostAuth = async () => {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    const userEmail = s.session?.user?.email;
    if (!uid || !userEmail) {
      router.replace('/');
      return;
    }

    // ψάχνουμε τον athlete με βάση το email (πιο αξιόπιστο)
    const { data, error } = await supabase
      .from('athletes')
      .select('id')
      .eq('email', userEmail)
      .maybeSingle();

    if (error?.code === 'PGRST116' || (!data && !error)) {
      router.replace('/athletes/add'); // δεν υπάρχει profile
      return;
    }

    if (!data && error) {
      console.warn('athletes lookup error', error);
      router.replace('/schedule');
      return;
    }

    // υπάρχει profile -> πάει στο schedule
    router.replace('/schedule');
  };

  // Auto redirect όταν ήδη έχει session
  useEffect(() => {
    if (sessionChecked && signedInEmail) {
      void routePostAuth();
    }
  }, [sessionChecked, signedInEmail]);

  const canEmail = useMemo(() => /\S+@\S+\.\S+/.test(email) && !busy, [email, busy]);
  const canPassword = useMemo(
    () => email.trim().length > 3 && password.trim().length >= 6 && !busy,
    [email, password, busy]
  );
  const canVerify = useMemo(
    () => email.trim().length > 3 && /^\d{6}$/.test(otp) && !busy,
    [email, otp, busy]
  );

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
        await startOtpFlow();
      }
    } catch (err: any) {
      setMsg(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const startOtpFlow = async () => {
    if (!supabase) return false;
    const emailRedirectTo = `${getSiteUrl()}/auth/confirm?new=1`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    if (error) {
      setMsg(error.message || 'Could not send verification code.');
      return false;
    }
    setMsg('We sent a 6-digit code to your email.');
    setStep('otp');
    return true;
  };

  // 🔐 Ενημερωμένη συνάρτηση login με hash έλεγχο
  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);

    try {
      const { data: athlete, error } = await supabase
        .from('athletes')
        .select('email, password_hash, user_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;
      if (!athlete) {
        setMsg('No athlete found with this email.');
        setBusy(false);
        return;
      }

      if (!athlete.password_hash) {
        setMsg('No password set for this account.');
        setBusy(false);
        return;
      }

      const match = await bcrypt.compare(password, athlete.password_hash);
      if (!match) {
        setMsg('Invalid password.');
        setBusy(false);
        return;
      }

      // login στο supabase auth
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: athlete.email,
        password,
      });

      if (loginError) {
        setMsg(loginError.message);
        setBusy(false);
        return;
      }

      await routePostAuth();
    } catch (err: any) {
      setMsg(err?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: 'email',
    });

    if (error || !data.session) {
      setMsg(error?.message || 'Invalid or expired code.');
      setBusy(false);
      return;
    }

    await routePostAuth();
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
        </div>

        {!sessionChecked && (
          <p className="text-sm text-zinc-400 text-center">Checking session…</p>
        )}

        {sessionChecked && !signedInEmail && (
          <>
            {step === 'email' && (
              <form onSubmit={onEmailSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                  required
                />
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm"
                  disabled={!canEmail}
                >
                  Continue
                </button>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={onPasswordSubmit} className="space-y-3">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                  required
                  minLength={6}
                />
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm"
                  disabled={!canPassword}
                >
                  Sign in
                </button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={onVerifyOtp} className="space-y-3">
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="tracking-widest text-center text-lg w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                  placeholder="••••••"
                  required
                />
                <button
                  type="submit"
                  className="w-full px-4 py-2 rounded border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm"
                  disabled={!canVerify}
                >
                  Verify code
                </button>
              </form>
            )}

            {msg && <div className="text-sm mt-2 text-zinc-200">{msg}</div>}
          </>
        )}
      </div>
    </section>
  );
}
