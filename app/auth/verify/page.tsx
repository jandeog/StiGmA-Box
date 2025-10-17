'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function VerifyPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null); setLoading(true);
    try {
      const supa = supabaseBrowser();
      const { error } = await supa.auth.signInWithOtp({ email, options: { shouldCreateUser: true }});
      if (error) setErr(error.message);
      else setMsg('Σου έστειλα 6-ψήφιο κωδικό στο email ✅');
    } catch (e:any) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null); setLoading(true);
    try {
      const supa = supabaseBrowser();
      const { data, error } = await supa.auth.verifyOtp({
        email,
        token,
        type: 'email', // 6-ψήφιο email OTP
      });
      if (error) setErr(error.message);
      else {
        setMsg('Επιτυχής σύνδεση 🎉');
        window.location.href = '/auth/me';
      }
    } catch (e:any) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-xl font-semibold">Email OTP</h1>
      <form onSubmit={requestCode} className="space-y-3">
        <input className="w-full rounded-lg px-3 py-2 bg-zinc-900 border border-zinc-700"
               type="email" required placeholder="you@example.com"
               value={email} onChange={e=>setEmail(e.target.value)} />
        <button className="w-full rounded-lg px-3 py-2 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700" disabled={loading}>
          Ζήτα κωδικό
        </button>
      </form>
      <form onSubmit={verifyCode} className="space-y-3">
        <input className="w-full rounded-lg px-3 py-2 bg-zinc-900 border border-zinc-700"
               inputMode="numeric" pattern="[0-9]*" maxLength={6}
               placeholder="6-ψήφιος κωδικός"
               value={token} onChange={e=>setToken(e.target.value)} />
        <button className="w-full rounded-lg px-3 py-2 border border-zinc-700 bg-zinc-800 hover:bg-zinc-700" disabled={loading}>
          Επαλήθευση
        </button>
      </form>
      {msg && <p className="text-green-400">{msg}</p>}
      {err && <p className="text-red-400">{err}</p>}
    </div>
  );
}
