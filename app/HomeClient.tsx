'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
import Image from 'next/image';

export default function HomeClient() {
  const supabase = getSupabaseBrowser();
const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const canSend = useMemo(() => /\S+@\S+\.\S+/.test(email) && !busy, [email, busy]);
  useEffect(() => {
    const target = params.get('redirect');
    if (!target) return;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace(target);            // ήδη συνδεδεμένος → πάμε κατευθείαν
      } else {
        router.replace(`/auth/confirm?redirect=${encodeURIComponent(target)}`);
      }
    };
    run();
  }, [params, router, supabase]);
  const handleSendMagicLink = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const emailRedirectTo = `${origin}/auth/confirm?redirect=/athletes/add`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,     // 🔸 Magic link → confirm page
          shouldCreateUser: true,
        },
      });

      if (error) throw error;
      setMsg('✅ Check your email for the magic link!');
    } catch (err: any) {
      setMsg('❌ ' + err.message);
    } finally {
      setBusy(false);
    }
  };

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
        <p className="text-sm text-zinc-400">Sign in using a magic link</p>

        <div className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm
                       focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
          />
          <button
            onClick={handleSendMagicLink}
            disabled={!canSend}
            className="w-full py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-sm disabled:opacity-50"
          >
            Send magic link
          </button>
        </div>

        {msg && <p className="text-xs text-zinc-400">{msg}</p>}
      </div>
    </main>
  );
}
