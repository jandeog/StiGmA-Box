'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Page() {
  const router = useRouter();
  const qs = useSearchParams();
  const redirect = qs.get('redirect') || '';

  const [step, setStep] = useState<'email'|'password'|'otp'|'sending'>('email');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [remember, setRemember] = useState(true);
  const [otp, setOtp] = useState('');
  const [exists, setExists] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<string>('');

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || 'Error');
    return j;
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    const eTrim = email.trim();
    if (!eTrim) return setMsg('Please enter an email');
    try {
      const { exists } = await post('/api/auth/check-email', { email: eTrim });
      setExists(exists);
      if (exists) {
        setStep('password');
      } else {
        setStep('sending');
        await post('/api/auth/request-otp', { email: eTrim });
        setStep('otp');
      }
    } catch (err: any) { setMsg(err.message); setStep('email'); }
  }

async function onPasswordSubmit(e: React.FormEvent) {
  e.preventDefault(); setMsg('');
  try {
    const { role } = await post('/api/auth/signin', { email: email.trim(), password: pwd, remember });
    const dest = role === 'coach' ? '/wod' : '/schedule';

    // HARD NAV -> layout re-renders and reads fresh cookies
    if (typeof window !== 'undefined') {
      window.location.href = dest;
    } else {
      router.replace(dest);
      router.refresh();
    }
  } catch (err: any) {
    setMsg(err.message);
  }
}



  async function onOtpSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg('');
    try {
      await post('/api/auth/verify-otp', { email: email.trim(), token: otp.trim() });
      if (typeof window !== 'undefined') {
  window.location.href = '/athletes/add';
} else {
  router.replace('/athletes/add');
  router.refresh();
}
    } catch (err: any) { setMsg(err.message); }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      {/* Big logo */}
<div className="flex justify-center mb-6">
  <img
    src="/images/Stigma-Logo-white-650x705.png"
    alt="StiGmA Box"
    width={120}
    height={130}
    style={{ opacity: 0.9 }}
    onError={(e) => {
      const img = e.currentTarget;
      img.src = '/favicon.ico';
      img.width = 64;
      img.height = 64;
    }}
  />
</div>

      <h1 className="text-xl font-semibold mb-4 text-center">Sign in / Sign up</h1>

      {step === 'email' && (
        <form onSubmit={onEmailSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm"
          />
          <button className="w-full rounded-md bg-white/10 px-3 py-2 text-sm">Continue</button>
        </form>
      )}

{step === 'password' && exists && (
  <form onSubmit={onPasswordSubmit} className="space-y-3">
    <div className="text-sm opacity-80">Email: {email}</div>

    <input
      type="password"
      placeholder="Password"
      value={pwd}
      onChange={(e)=>setPwd(e.target.value)}
      className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm"
    />

    <div className="flex gap-2">
      <button className="flex-1 rounded-md bg-white/10 px-3 py-2 text-sm">Sign in</button>
      <button
        type="button"
        className="flex-1 rounded-md border border-zinc-700 px-3 py-2 text-sm"
        onClick={() => setStep('email')}
      >
        Back
      </button>
    </div>

    {/* remember me — one line, under buttons */}
    <label className="flex items-center justify-center gap-2 text-xs text-zinc-300">
      <input
        type="checkbox"
        checked={remember}
        onChange={(e)=>setRemember(e.target.checked)}
        className="accent-zinc-600"
      />
      Remember me (30 days)
    </label>
  </form>
)}


      {step === 'otp' && exists === false && (
        <form onSubmit={onOtpSubmit} className="space-y-3">
          <div className="text-sm opacity-80 text-center">
            We sent a 6-digit code to <b>{email}</b>. Enter it below:
          </div>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="------"
            value={otp}
            onChange={(e)=>setOtp(e.target.value.replace(/\D/g,''))}
            className="w-full tracking-widest text-center text-lg rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2"
          />
          <div className="flex gap-2">
            <button className="flex-1 rounded-md bg-white/10 px-3 py-2 text-sm">Verify</button>
            <button
              type="button"
              className="flex-1 rounded-md border border-zinc-700 px-3 py-2 text-sm"
              onClick={() => setStep('email')}
            >
              Back
            </button>
          </div>
        </form>
      )}

      {step === 'sending' && <p className="text-sm text-zinc-400">Sending OTP…</p>}
      {msg && <p className="mt-4 text-red-400 text-sm text-center">{msg}</p>}
    </main>
  );
}
