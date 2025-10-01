// app/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

// Κλειδιά τοπικής αποθήκευσης (συμβατά με Add Athlete)
const KEY_ATHLETES = 'athletes';
const KEY_AUTH = 'auth:user';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_say';

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
  createdAt: string;
  updatedAt: string;
  // (άλλα optional πεδία τα αγνοούμε εδώ)
};

type Session = { role: 'coach' | 'athlete'; athleteId?: string };

export default function LoginOrSetupPage() {
  const router = useRouter();

  // αν είμαστε ήδη logged in, προώθηση
  useEffect(() => {
    const raw = localStorage.getItem(KEY_AUTH);
    if (raw) router.replace('/score');
  }, [router]);

  // φόρτωσε λίστα athletes για να δούμε αν υπάρχει έστω ένας
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY_ATHLETES);
      setAthletes(raw ? (JSON.parse(raw) as Athlete[]) : []);
    } catch {
      setAthletes([]);
    }
  }, []);

  const hasAnyAthlete = athletes.length > 0;

  // ===== LOGIN (όταν υπάρχουν athletes) =====
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');

  const normalizePhone = (s: string) => s.replace(/[^\d+]/g, '').trim();

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
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
    const role: 'coach' | 'athlete' = found.isCoach ? 'coach' : 'athlete';
    const session: Session = { role, athleteId: found.id };
    localStorage.setItem(KEY_AUTH, JSON.stringify(session));
    window.dispatchEvent(new Event('auth:changed'));
    router.replace('/score');
  };

  // ===== FIRST-RUN SETUP (όταν ΔΕΝ υπάρχουν athletes) =====
  const [fFirst, setFFirst] = useState('');
  const [fLast, setFLast] = useState('');
  const [fDob, setFDob] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fTeam, setFTeam] = useState('');
  const [setupMsg, setSetupMsg] = useState('');

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRe = /^[\d+\-\s()]{6,20}$/;

  const canSetup = useMemo(() => {
    return (
      fFirst.trim() &&
      fLast.trim() &&
      fDob &&
      emailRe.test(fEmail.trim()) &&
      phoneRe.test(fPhone.trim())
    );
  }, [fFirst, fLast, fDob, fEmail, fPhone]);

  const doFirstRunSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSetup) {
      setSetupMsg('Please fill all required fields correctly.');
      setTimeout(() => setSetupMsg(''), 1800);
      return;
    }
    if (!window.confirm('Create the first user as COACH and sign in?')) return;
    const now = new Date().toISOString();
    const rec: Athlete = {
      id: crypto.randomUUID(),
      firstName: fFirst.trim(),
      lastName: fLast.trim(),
      teamName: fTeam.trim() || undefined,
      dob: fDob,
      email: fEmail.trim(),
      phone: fPhone.trim(),
      isCoach: true,
      createdAt: now,
      updatedAt: now,
    };
    const next = [rec];
    localStorage.setItem(KEY_ATHLETES, JSON.stringify(next));
    window.dispatchEvent(new Event('athletes:changed'));
    // login ως coach
    const session: Session = { role: 'coach', athleteId: rec.id };
    localStorage.setItem(KEY_AUTH, JSON.stringify(session));
    window.dispatchEvent(new Event('auth:changed'));
    setSetupMsg('✅ Created coach & signed in.');
    setTimeout(() => {
      router.replace('/athletes/add?id=' + rec.id);
    }, 600);
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
          <h1 className="mt-3 text-xl font-semibold">
            {hasAnyAthlete ? 'Sign in' : 'First-run setup'}
          </h1>
          <p className="text-sm text-zinc-400">
            {hasAnyAthlete
              ? 'with your Athlete email & phone'
              : 'Create the first Coach to bootstrap the system'}
          </p>
        </div>

        {hasAnyAthlete ? (
          <form onSubmit={doLogin} className="space-y-3">
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
        ) : (
          <form onSubmit={doFirstRunSetup} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1 text-zinc-300">First name *</label>
                <input
                  value={fFirst}
                  onChange={(e) => setFFirst(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-zinc-300">Last name *</label>
                <input
                  value={fLast}
                  onChange={(e) => setFLast(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Date of birth *</label>
              <input
                type="date"
                value={fDob}
                onChange={(e) => setFDob(e.target.value)}
                className="datepicker-white-icon w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1 text-zinc-300">Email *</label>
                <input
                  value={fEmail}
                  onChange={(e) => setFEmail(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-sm mb-1 text-zinc-300">Phone *</label>
                <input
                  value={fPhone}
                  onChange={(e) => setFPhone(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                  placeholder="+30 69..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Team (optional)</label>
              <input
                value={fTeam}
                onChange={(e) => setFTeam(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                placeholder="e.g. Red"
              />
            </div>
            <button
              className="w-full mt-2 px-4 py-2 rounded border border-emerald-700 bg-emerald-900/30 hover:bg-emerald-900/50 text-sm disabled:opacity-50"
              disabled={!canSetup}
            >
              Create first coach & Sign in
            </button>
            {setupMsg && <div className="text-sm mt-1">{setupMsg}</div>}
          </form>
        )}
      </div>
    </section>
  );
}
