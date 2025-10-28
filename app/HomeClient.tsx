'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import bcrypt from 'bcryptjs';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

// --------------------------------------------------
// Types
// --------------------------------------------------
type Step = 'email' | 'password' | 'otp';

// --------------------------------------------------
// Component
// --------------------------------------------------

export default function HomeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = getSupabaseBrowser();

  // ----------------------------------------------
  // 0) Redirect cleanup
  // ----------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasToken = window.location.hash.includes('access_token=');
    const target = params.get('redirect');
    if (hasToken || target) {
      const next = target || '/athletes/add';
      router.replace(`/auth/confirm?redirect=${encodeURIComponent(next)}`);
    }
  }, [router, params]);

  // ----------------------------------------------
  // 1) State
  // ----------------------------------------------
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canEmail = useMemo(() => /\S+@\S+\.\S+/.test(email) && !busy, [email, busy]);
  const canPassword = useMemo(() => email && password.length >= 6 && !busy, [email, password, busy]);
  const canVerify = useMemo(() => /^\d{6}$/.test(otp) && !busy, [otp, busy]);

  const redirectedRef = useRef(false);

  // ----------------------------------------------
  // 2) Post-auth redirect
  // ----------------------------------------------
  const routePostAuth = async () => {
    if (redirectedRef.current) return;
    const { data: s } = await supabase.auth.getSession();
    const user = s.session?.user;
    if (!user?.id) return;

    const { data } = await supabase
      .from('athletes')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      redirectedRef.current = true;
      if (data.role === 'coach') router.replace('/schedule');
      else router.replace('/display');
    } else {
      redirectedRef.current = true;
      router.replace('/athletes/add');
    }
  };

  // ----------------------------------------------
  // 3) Handlers
  // ----------------------------------------------
  const handleSendOtp = async () => {
    setBusy(true);
    setMsg(null);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?redirect=/athletes/add`,
      },
    });
    if (error) setMsg(error.message);
    else setMsg('Check your email for the sign-in link!');
    setBusy(false);
  };

  const handlePasswordLogin = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else routePostAuth();
    setBusy(false);
  };

  const handleVerifyOtp = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error) setMsg(error.message);
    else routePostAuth();
    setBusy(false);
  };

  // ----------------------------------------------
  // 4) UI
  // ----------------------------------------------
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-zinc-300">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Image
          src="/logo.svg"
          alt="StiGmA-Box Logo"
          width={120}
          height={120}
          className="mx-auto mb-4 opacity-90"
        />
        <h1 className="text-3xl font-bold tracking-tight">Welcome to StiGmA-Box</h1>
        <p className="text-sm text-zinc-400">Sign in or request a magic link to continue</p>

        {step === 'email' && (
          <div className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setStep('password')}
                disabled={!canEmail}
                className="w-full py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-50"
              >
                Continue with password
              </button>
              <button
                onClick={handleSendOtp}
                disabled={!canEmail}
                className="w-full py-2 rounded-md border border-zinc-700 hover:bg-zinc-800 text-sm disabled:opacity-50"
              >
                Send magic link
              </button>
            </div>
          </div>
        )}

        {step === 'password' && (
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
            />
            <div className="flex justify-between text-xs text-zinc-500">
              <button onClick={() => setStep('email')} className="hover:text-zinc-300">
                Back
              </button>
            </div>
            <button
              onClick={handlePasswordLogin}
              disabled={!canPassword}
              className="w-full py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-50"
            >
              Sign in
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-3">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit code"
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={!canVerify}
              className="w-full py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-50"
            >
              Verify OTP
            </button>
          </div>
        )}

        {msg && <p className="text-xs text-zinc-400">{msg}</p>}
      </div>
    </main>
  );
}
