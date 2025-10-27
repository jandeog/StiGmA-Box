'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';
const supabase = getSupabaseBrowser();

export default function ResetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-400">Loading…</div>}>
      <ResetInner />
    </Suspense>
  );
}

function ResetInner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const canSubmit = useMemo(() => pw1.length >= 6 && pw1 === pw2 && !busy, [pw1, pw2, busy]);

  // Optional: ensure session exists (user arrived via valid link)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setMsg('Το link έχει λήξει ή δεν είναι έγκυρο. Ζήτησε νέο reset από την αρχική οθόνη.');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;
      setMsg('Το password άλλαξε επιτυχώς. Μεταφορά στο Schedule…');
      // μικρή καθυστέρηση για UX
      setTimeout(() => router.replace('/schedule'), 600);
    } catch (err: any) {
      setMsg(err?.message || 'Αποτυχία αλλαγής password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-h-[85vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-900 rounded-2xl p-6 shadow">
        <h1 className="text-lg font-semibold mb-4">Set a new password</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">New password</label>
            <input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Confirm password</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
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
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </section>
  );
}
