'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';


export const dynamic = 'force-dynamic';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_say';

const supabase =
  typeof window !== 'undefined'
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : (null as any);

const field =
  'w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm field-muted ' +
  'focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm';

function AddAthleteInner() {
  const router = useRouter();

  // session/user
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [emailLocked, setEmailLocked] = useState<string>('');

  // form state
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [nickname, setNickname]     = useState('');
  const [teamName, setTeamName]     = useState('');
  const [dob, setDob]               = useState('');
  const [phone, setPhone]           = useState('');
  const [gender, setGender]         = useState<Gender | ''>('');
  const [heightCm, setHeightCm]     = useState<string>('');
  const [weightKg, setWeightKg]     = useState<string>('');
  const [years, setYears]           = useState<string>('');
  const [notes, setNotes]           = useState('');
  const [emName, setEmName]         = useState('');
  const [emPhone, setEmPhone]       = useState('');
  // password optional (να ορίσει password αν θέλει)
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');

  const [isCoachFlag, setIsCoachFlag] = useState(false); // μόνο αν θέλεις να το χρησιμοποιήσεις – αλλιώς μπορείς να το κρύψεις
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState<string | null>(null);

  const canSave = useMemo(() => {
    const baseOk =
      firstName.trim() &&
      lastName.trim() &&
      dob &&
      phone.trim();
    const pwOk = !newPw1 && !newPw2 ? true : (newPw1.length >= 6 && newPw1 === newPw2);
    return !!baseOk && pwOk && !busy && !!userId;
  }, [firstName, lastName, dob, phone, newPw1, newPw2, busy, userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      // πρέπει να είναι συνδεδεμένος
      const { data: s } = await supabase.auth.getSession();
      const cur = s.session;
      if (!mounted) return;

      if (!cur) {
        router.replace('/'); // όχι session -> πίσω στην αρχική
        return;
      }

      const uid = cur.user.id;
      setUserId(uid);
      setEmailLocked(cur.user.email || '');

      // αν υπάρχει ήδη profile, προπλήρωσέ το (και αν θέλεις redirect στο schedule)
      const { data: existing, error } = await supabase
        .from('athletes')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        // αν η athletes δεν υπάρχει ακόμη, άσε το form να φορτώσει κανονικά
        console.warn('athletes fetch error', error.message);
      } else if (existing) {
        // αν θέλεις να εμποδίσεις τη 2η εγγραφή, στείλ’τον schedule:
        router.replace('/schedule');
        return;
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!supabase || !userId) return;
  setBusy(true);
  setMsg(null);

  try {
    // 1) Αν ορίζει password εδώ, κάνε hash
    let hashed = null;
    if (newPw1 && newPw2) {
      if (newPw1.length < 6 || newPw1 !== newPw2) {
        setMsg('Passwords must match and be at least 6 characters.');
        setBusy(false);
        return;
      }
      hashed = await bcrypt.hash(newPw1, 10);
    }

    // 2) Δημιουργία payload για την εγγραφή
    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      nickname: nickname.trim() || null,
      team_name: teamName.trim() || null,
      dob,
      email: emailLocked,
      phone: phone.trim(),
      gender: gender || null,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      years_of_experience: years ? Number(years) : null,
      credits: 0,
      notes: notes || null,
      emergency_name: emName || null,
      emergency_phone: emPhone || null,
      is_coach: isCoachFlag || false,
      password_hash: hashed,
      created_at: now,
      updated_at: now,
    };

    // 3) Αποθήκευση στη βάση
    const { error: upsertErr } = await supabase.from('athletes').insert(payload);
    if (upsertErr) throw upsertErr;

    setMsg('✅ Profile saved. Redirecting…');
    setTimeout(() => router.replace('/schedule'), 600);
  } catch (err: any) {
    setMsg(err?.message || 'Failed to save profile.');
  } finally {
    setBusy(false);
  }
};


  if (loading) {
    return (
      <section className="min-h-[70vh] grid place-items-center text-sm text-zinc-400">
        Loading…
      </section>
    );
  }

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Add Athlete</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Identity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              First name <span className="text-red-400">*</span>
            </label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Last name <span className="text-red-400">*</span>
            </label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={field} />
          </div>
        </div>

        {/* Team + Nickname */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Team name</label>
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Nickname</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} className={field} />
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Email (locked)
            </label>
            <input value={emailLocked} readOnly className={`${field} opacity-70`} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Phone <span className="text-red-400">*</span>
            </label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={field} placeholder="69..." />
          </div>
        </div>

        {/* DOB + Gender */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Date of birth <span className="text-red-400">*</span>
            </label>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Gender</label>
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender | '')} className={field}>
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        {/* Body metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Height (cm)</label>
            <input inputMode="numeric" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Weight (kg)</label>
            <input inputMode="numeric" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={field} />
          </div>
        </div>

        {/* Experience + Credits (credits locked=0 στην αρχή) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Years of experience</label>
            <input inputMode="numeric" value={years} onChange={(e) => setYears(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Credits (auto)</label>
            <input value="0" readOnly className={`${field} opacity-70`} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm mb-1 text-zinc-300">Notes (injuries, allergies, etc.)</label>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
        </div>

        {/* Emergency contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Emergency contact name</label>
            <input value={emName} onChange={(e) => setEmName(e.target.value)} className={field} />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Emergency contact phone</label>
            <input value={emPhone} onChange={(e) => setEmPhone(e.target.value)} className={field} />
          </div>
        </div>

        {/* Optional: set password now */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Set password (optional)</label>
            <input
              type="password"
              value={newPw1}
              onChange={(e) => setNewPw1(e.target.value)}
              className={field}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Confirm password</label>
            <input
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              className={field}
              placeholder="••••••••"
              minLength={6}
            />
          </div>
        </div>

        {msg && <div className="text-sm text-zinc-200">{msg}</div>}

        <div className="flex items-center gap-2">
          <button
            className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm disabled:opacity-50"
            disabled={!canSave}
          >
            Save athlete
          </button>
        </div>
      </form>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-400">Loading…</div>}>
      <AddAthleteInner />
    </Suspense>
  );
}
