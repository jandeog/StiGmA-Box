'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const supa = supabaseBrowser();
      const origin = window.location.origin;
      const { error } = await supa.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=/auth/me`,
        },
      });
      if (error) setErr(error.message);
      else setMsg('Check your email for the magic link ✅');
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-4">Login</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg px-3 py-2 bg-zinc-900 border border-zinc-700"
        />
        <button
          disabled={loading}
          className="w-full rounded-lg px-3 py-2 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
        >
          {loading ? 'Sending…' : 'Send magic link'}
        </button>
      </form>
      {msg && <p className="text-green-400 mt-3">{msg}</p>}
      {err && <p className="text-red-400 mt-3">{err}</p>}
    </div>
  );
}
