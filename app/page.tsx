// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Το Add Athlete αποθηκεύει σε αυτό το key μια λίστα Athlete records
// (ίδιο key με το υπάρχον Add Athlete flow)
const KEY_ATHLETES = 'athletes'; // :contentReference[oaicite:1]{index=1}
const KEY_AUTH     = 'auth:user';

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  teamName?: string;
  dob: string;
  email: string;
  phone: string;
  isCoach?: boolean;
  // ... κρατάμε μόνο τα βασικά που μας νοιάζουν για login
};

export default function LoginPage() {
  const router = useRouter();

  // αν είμαστε ήδη logged in, προώθηση
  useEffect(() => {
    const raw = localStorage.getItem(KEY_AUTH);
    if (raw) {
      router.replace('/score');
    }
  }, [router]);

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');

  const normalizePhone = (s: string) => s.replace(/[^\d+]/g, '').trim();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = localStorage.getItem(KEY_ATHLETES);
    const athletes: Athlete[] = raw ? JSON.parse(raw) : [];

    const needleEmail = email.trim().toLowerCase();
    const needlePhone = normalizePhone(phone);

    const found = athletes.find((a) => {
      const ae = (a.email || '').trim().toLowerCase();
      const ap = normalizePhone(a.phone || '');
      return ae === needleEmail && ap === needlePhone;
    });

    if (!found) {
      setMsg('❌ Invalid email or phone');
      return;
    }

// ΝΕΟ (σωστό): role από το isCoach του athlete
const role: 'coach' | 'athlete' = found.isCoach ? 'coach' : 'athlete';

const session = {
  role,
  athleteId: found.id,
  email: found.email,
  phone: found.phone,
  name: `${found.firstName} ${found.lastName}`,
  nickname: found.nickname || undefined,
  teamName: found.teamName || undefined,
};

localStorage.setItem('auth:user', JSON.stringify(session));
window.dispatchEvent(new Event('auth:changed'));
localStorage.setItem('auth:user', JSON.stringify(session));
window.dispatchEvent(new Event('auth:changed')); // ενημέρωσε το menu/Logout

    setMsg('✅ Signed in');
    router.replace('/score'); // οι αθλητές πηγαίνουν να καταχωρήσουν score
  };

  return (
    <section className="min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-900 rounded-2xl p-6 shadow">
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/images/Stigma-Logo-white-650x705.png"
            alt="Stigma Logo"
            width={160}
            height={160}
            priority
            className="w-28 sm:w-36 md:w-40 h-auto mx-auto"
          />
          <h1 className="mt-3 text-xl font-semibold">Sign in</h1>
          <p className="text-sm text-zinc-400">with your Athlete email & phone</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              placeholder="you@example.com"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Phone</label>
            <input
              type="password"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              placeholder="+30 69..."
            />
          </div>

          {msg && <div className="text-sm mt-1">{msg}</div>}

          <button
            className="w-full mt-2 px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
            type="submit"
          >
            Sign in
          </button>

          <div className="text-xs text-zinc-500 mt-2">
            Tip: πρόσθεσε ή δες αθλητές από <span className="font-mono">/athletes</span> (Add Athlete).
          </div>
        </form>
      </div>
    </section>
  );
}
