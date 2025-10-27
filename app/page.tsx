'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// 1) Σταθερός client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Step = 'email' | 'password' | 'otp';

const getSiteUrl = () => {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
};

export default function Page() {
  const router = useRouter();

  // UI state
  const [sessionChecked, setSessionChecked] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canEmail = useMemo(() => /\S+@\S+\.\S+/.test(email) && !busy, [email, busy]);
  const canPassword = useMemo(
    () => email.trim().length > 3 && password.trim().length >= 6 && !busy,
    [email, password, busy]
  );
  const canVerify = useMemo(
    () => email.trim().length > 3 && /^\d{6}$/.test(otp) && !busy,
    [email, otp, busy]
  );

  // 2) Redirect guard ώστε να μην γίνεται διπλό/άπειρο redirect
  const redirectedRef = useRef(false);

  // 3) Ενιαία συνάρτηση μετά-auth δρομολόγησης
  const routePostAuth = async () => {
    if (redirectedRef.current) return;
    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user?.id || !user.email) return;

    // Έλεγχος με βάση email (πιο αξιόπιστο)
    const { data, error } = await supabase
      .from('athletes')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();

    redirectedRef.current = true; // από εδώ και πέρα, μην ξανατρέξεις redirect
    if (error?.code === 'PGRST116' || (!data && !error)) {
      router.replace('/athletes/add'); // δεν υπάρχει profile
      return;
    }
    router.replace('/schedule'); // υπάρχει profile ή fallback
  };

  // 4) Ένα αρχικό session check + ένας listener για αλλαγές
  useEffect(() => {
    let unsub: () => void;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const current = data.session?.user?.email ?? null;
        setSignedInEmail(current);
      } catch {
        setSignedInEmail(null);
      } finally {
        setSessionChecked(true);
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
        const emailNow = sess?.user?.email ?? null;
        setSignedInEmail(emailNow);
        // μόλις υπάρξει session, κάνε μία και καλή δρομολόγηση
        if (emailNow) void routePostAuth();
      });

      unsub = () => sub.subscription.unsubscribe();
    };

    init();
    return () => { unsub && unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Αν κατά το initial check είχαμε ήδη session, κάνε redirect μία φορά
  useEffect(() => {
    if (sessionChecked && signedInEmail) {
      void routePostAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionChecked, signedInEmail]);

  // -------- Email step: ελέγχει αν υπάρχει στον athletes --------
  const onEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/email-exists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Lookup failed');
      setStep(json.exists ? 'password' : 'otp');
      if (!json.exists) {
        // ξεκίνα OTP αμέσως για νέους χρήστες
        await startOtpFlow();
      }
    } catch (err: any) {
      setMsg(err?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  // -------- Start OTP (signup-or-login) --------
  const startOtpFlow = async () => {
    setMsg(null);
    const emailRedirectTo = `${getSiteUrl()}/auth/confirm?new=1`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo },
    });
    if (error) setMsg(error.message || 'Could not send verification code.');
  };

  // -------- Password sign-in με hash check στον athletes --------
  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { data: athlete, error } = await supabase
        .from('athletes')
        .select('email, password_hash, user_id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (error) throw error;
      if (!athlete) { setMsg('No athlete found with this email.'); return; }
      if (!athlete.password_hash) { setMsg('No password set for this account.'); return; }

      const ok = await bcrypt.compare(password, athlete.password_hash);
      if (!ok) { setMsg('Invalid password.'); return; }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: athlete.email,
        password,
      });
      if (loginError) { setMsg(loginError.message); return; }

      await routePostAuth();
    } catch (err: any) {
      setMsg(err?.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  // -------- Verify 6-digit code (email OTP) --------
  const onVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
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

  // ---------------- UI ----------------
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
