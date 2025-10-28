'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// --------------------------------------------------
// Types
// --------------------------------------------------

type Gender = 'male' | 'female' | 'other' | 'prefer_not_say';

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --------------------------------------------------
// Component
// --------------------------------------------------

function AddAthleteInner() {
  const router = useRouter();
  const search = useSearchParams();
  const editId = search.get('id'); // Αν υπάρχει, σημαίνει edit mode

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [emailLocked, setEmailLocked] = useState('');

  // form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [teamName, setTeamName] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [years, setYears] = useState('');
  const [notes, setNotes] = useState('');
  const [emName, setEmName] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const [newPw1, setNewPw1] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [isCoachFlag, setIsCoachFlag] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
useEffect(() => {
  let cancel = false;

  const ensureSession = async () => {
    const { data: s } = await supabase.auth.getSession();
    if (s.session || cancel) return;

    // Περίμενε λίγο μήπως ολοκληρωθεί από το confirm
    const { data: sub } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'SIGNED_IN' && !cancel) {
        // έχει φτιαχτεί session, απλώς συνεχίζουμε
      }
    });

    setTimeout(() => {
      if (!cancel) {
        // αν ακόμη δεν υπάρχει, τότε γύρνα στο /
        router.replace(`/?redirect=${encodeURIComponent('/athletes/add')}`);
      }
    }, 2000);

    return () => sub?.subscription?.unsubscribe?.();
  };

  ensureSession();
  return () => { cancel = true; };
}, [router]);

  // Validation
  const canSave = useMemo(() => {
    const baseOk = firstName.trim() && lastName.trim() && dob && phone.trim();
    const pwOk = !newPw1 && !newPw2 ? true : (newPw1.length >= 6 && newPw1 === newPw2);
    return !!baseOk && pwOk && !busy && !!userId;
  }, [firstName, lastName, dob, phone, newPw1, newPw2, busy, userId]);

  // --------------------------------------------------
  // Fetch session + existing profile
  // --------------------------------------------------
  useEffect(() => {
    const load = async () => {
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;

      if (!user) {
        router.replace('/');
        return;
      }

      setUserId(user.id);
      setEmailLocked(user.email ?? '');

      // αν υπάρχει id στο URL, τότε είμαστε σε edit mode
      const targetId = editId || null;
      let query = supabase.from('athletes').select('*').eq('user_id', user.id);
      if (targetId) query = query.eq('id', targetId);

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('athletes fetch error', error.message);
      } else if (data) {
        // προπλήρωση form
        setFirstName(data.first_name ?? '');
        setLastName(data.last_name ?? '');
        setNickname(data.nickname ?? '');
        setTeamName(data.team_name ?? '');
        setDob(data.dob ?? '');
        setPhone(data.phone ?? '');
        setGender(data.gender ?? '');
        setHeightCm(data.height_cm?.toString() ?? '');
        setWeightKg(data.weight_kg?.toString() ?? '');
        setYears(data.years_of_experience?.toString() ?? '');
        setNotes(data.notes ?? '');
        setEmName(data.emergency_name ?? '');
        setEmPhone(data.emergency_phone ?? '');
        setIsCoachFlag(!!data.is_coach);
      }

      setLoading(false);
    };

    load();
  }, [router, editId]);

  // --------------------------------------------------
  // Submit handler
  // --------------------------------------------------
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !userId) return;
    setBusy(true);
    setMsg(null);

    try {
      // Optional password
      let hashed = null;
      if (newPw1 && newPw2) {
        if (newPw1.length < 6 || newPw1 !== newPw2) {
          setMsg('Passwords must match and be at least 6 characters.');
          setBusy(false);
          return;
        }
        hashed = await bcrypt.hash(newPw1, 10);
      }

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
        updated_at: now,
      };

      // Αν υπάρχει ήδη entry => update, αλλιώς insert
      const { data: existing } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      let result;
      if (existing) {
        result = await supabase.from('athletes').update(payload).eq('id', existing.id);
      } else {
        result = await supabase.from('athletes').insert({ ...payload, created_at: now });
      }

      if (result.error) throw result.error;

      setMsg('✅ Profile saved. Redirecting…');
      setTimeout(() => router.replace('/schedule'), 800);
    } catch (err: any) {
      console.error(err);
      setMsg(err?.message || 'Failed to save profile.');
    } finally {
      setBusy(false);
    }
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  if (loading) {
    return (
      <section className="min-h-[70vh] grid place-items-center text-sm text-zinc-400">
        Loading athlete data…
      </section>
    );
  }

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">
        {editId ? 'Edit Athlete' : 'Add Athlete'}
      </h1>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* First / Last Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              First name <span className="text-red-400">*</span>
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Last name <span className="text-red-400">*</span>
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
            />
          </div>
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Email (locked)</label>
            <input
              value={emailLocked}
              readOnly
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm opacity-70"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Phone <span className="text-red-400">*</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
              placeholder="69..."
            />
          </div>
        </div>

        {/* DOB + Gender */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Date of birth *</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | '')}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_say">Prefer not to say</option>
            </select>
          </div>
        </div>

        {/* Optional password */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Set password (optional)</label>
            <input
              type="password"
              value={newPw1}
              onChange={(e) => setNewPw1(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm"
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Confirm password</label>
            <input
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm"
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
