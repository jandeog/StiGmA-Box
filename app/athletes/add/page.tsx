'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_say';
type Mode = 'signup' | 'edit-self' | 'coach-edit' | 'coach-new';

function getCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

export default function AddAthletePage() {
  const router = useRouter();
  const qs = useSearchParams();
  const redirect = qs.get('redirect') || '';
  const targetId = qs.get('id') || null;
  const createNew = qs.get('new') === '1';

  const [mode, setMode] = useState<Mode>('signup');

  // who am I
  const [myId, setMyId] = useState<string | null>(null);
  const [iAmCoach, setIAmCoach] = useState(false);

  // core fields
  const [email, setEmail] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [changePassword, setChangePassword] = useState(false);

  // profile fields
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
  const [isCoachFlag, setIsCoachFlag] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Decide mode & prefill
 useEffect(() => {
  let alive = true;

  (async () => {
    // 1) ποιος είμαι
    const meRes = await fetch('/api/me', { cache: 'no-store' });
    let me: any = null;
    if (meRes.ok) {
      const j = await meRes.json();
      me = j?.me ?? null;
    }
    const myIdLocal: string | null = me?.id ?? null;
    const iAmCoachLocal: boolean = !!me?.is_coach;

    if (!alive) return;

    setMyId(myIdLocal);
    setIAmCoach(iAmCoachLocal);

    // 2) OTP -> signup υπερισχύει
    const signupEmail = getCookie('sbx_signup_email');
    if (signupEmail) {
      setMode('signup');
      setEmail(signupEmail);
      return;
    }

    // 3) Coach New -> κενή φόρμα με editable email + password
    if (createNew && iAmCoachLocal) {
      setMode('coach-new');
      // clear όλα
      setEmail('');
      setFirstName(''); setLastName(''); setNickname(''); setTeamName('');
      setDob(''); setPhone(''); setGender(''); setHeightCm(''); setWeightKg('');
      setYears(''); setNotes(''); setEmName(''); setEmPhone('');
      setIsCoachFlag(false);
      return;
    }

    // 4) Coach Edit Other -> φόρτωσε τον επιλεγμένο athlete
    if (targetId && iAmCoachLocal && targetId !== myIdLocal) {
      setMode('coach-edit');

      // cache-buster για να μην κολλήσει σε cached απάντηση
      const r = await fetch(`/api/athletes/${encodeURIComponent(targetId)}?t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (r.ok) {
        const { athlete } = await r.json();
        if (athlete && alive) {
          setEmail(athlete.email || '');
          setFirstName(athlete.first_name || '');
          setLastName(athlete.last_name || '');
          setNickname(athlete.nickname || '');
          setTeamName(athlete.team_name || '');
          setDob(athlete.dob || '');
          setPhone(athlete.phone || '');
          setGender(athlete.gender || '');
          setHeightCm(athlete.height_cm ? String(athlete.height_cm) : '');
          setWeightKg(athlete.weight_kg ? String(athlete.weight_kg) : '');
          setYears(athlete.years_of_experience ? String(athlete.years_of_experience) : '');
          setNotes(athlete.notes || '');
          setEmName(athlete.emergency_name || '');
          setEmPhone(athlete.emergency_phone || '');
          setIsCoachFlag(!!athlete.is_coach);
        }
      }
      return;
    }

    // 5) Default: edit-self
    setMode('edit-self');
    if (me && alive) {
      setEmail(me.email || '');
      setFirstName(me.first_name || '');
      setLastName(me.last_name || '');
      setNickname(me.nickname || '');
      setTeamName(me.team_name || '');
      setDob(me.dob || '');
      setPhone(me.phone || '');
      setGender(me.gender || '');
      setHeightCm(me.height_cm ? String(me.height_cm) : '');
      setWeightKg(me.weight_kg ? String(me.weight_kg) : '');
      setYears(me.years_of_experience ? String(me.years_of_experience) : '');
      setNotes(me.notes || '');
      setEmName(me.emergency_name || '');
      setEmPhone(me.emergency_phone || '');
      setIsCoachFlag(!!me.is_coach);
    }
  })();

  return () => { alive = false; };
// επανα-τρέχει όταν αλλάζει το URL (?id / ?new)
}, [targetId, createNew]);


  const needsPassword =
  mode === 'signup' || mode === 'coach-new' || (mode === 'edit-self' && changePassword);


  const canSubmit = useMemo(() => {
    if (busy || !email) return false;
    if (needsPassword) return pw1.length >= 6 && pw1 === pw2;
    return true;
  }, [busy, email, needsPassword, pw1, pw2]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!canSubmit) return;
    setBusy(true);

    try {
      if (mode === 'coach-edit' && targetId) {
        // coach updates someone else (no email/password)
        const payload: any = {
          first_name: firstName || null,
          last_name: lastName || null,
          nickname: nickname || null,
          team_name: teamName || null,
          dob: dob || null,
          phone: phone || null,
          gender: gender || null,
          height_cm: heightCm ? Number(heightCm) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          years_of_experience: years ? Number(years) : null,
          notes: notes || null,
          emergency_name: emName || null,
          emergency_phone: emPhone || null,
          is_coach: isCoachFlag,
        };

        const r = await fetch(`/api/athletes/${encodeURIComponent(targetId)}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || 'Error');
        router.replace('/athletes');
        return;
      }
if (mode === 'coach-new') {
  if (!email.trim()) throw new Error('Email is required');
  if (pw1.length < 6 || pw1 !== pw2) throw new Error('Password invalid or mismatch');

  const payload: any = {
    email: email.trim(),
    password: pw1,
    first_name: firstName || null,
    last_name: lastName || null,
    nickname: nickname || null,
    team_name: teamName || null,
    dob: dob || null,
    phone: phone || null,
    gender: gender || null,
    height_cm: heightCm ? Number(heightCm) : null,
    weight_kg: weightKg ? Number(weightKg) : null,
    years_of_experience: years ? Number(years) : null,
    notes: notes || null,
    emergency_name: emName || null,
    emergency_phone: emPhone || null,
    is_coach: isCoachFlag,
  };

  const r = await fetch('/api/athletes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || 'Error');

  // μετά τη δημιουργία, γύρνα στη λίστα (ή αν θέλεις πήγαινε στο /athletes/add?id=j.id)
  router.replace('/athletes');
  return;
}

      // signup or edit-self → complete-signup API
      const payload: any = {
  email,
  first_name: firstName || undefined,
  last_name: lastName || undefined,
  nickname: nickname || undefined,
  team_name: teamName || undefined,
  dob: dob || undefined,
  phone: phone || undefined,
  gender: gender || undefined,
  height_cm: heightCm ? Number(heightCm) : undefined,
  weight_kg: weightKg ? Number(weightKg) : undefined,
  years_of_experience: years ? Number(years) : undefined,
  notes: notes || undefined,
  emergency_name: emName || undefined,
  emergency_phone: emPhone || undefined,
};

// μόνο coach επιτρέπεται να το στείλει
if (iAmCoach) payload.is_coach = isCoachFlag || undefined;

if (needsPassword) payload.password = pw1;

const r = await fetch('/api/auth/complete-signup', {
  method: 'POST',
  body: JSON.stringify(payload),
});
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Error');

      // redirect ανά ρόλο (όπως έχουμε ορίσει)
      if (j.role === 'coach') router.replace('/wod');
      else router.replace(redirect || '/schedule');
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold mb-4">
        {mode === 'signup' ? 'Complete your profile' : mode === 'coach-edit' ? 'Edit athlete' : 'Your settings'}
      </h1>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* SECTION: Account */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium mb-3 text-zinc-300">Account</h2>

          {/* Email (always locked here) */}
          <div>
            <label className="block text-xs mb-1 text-zinc-400">Email</label>
            <input
  type="email"
  value={email}
  onChange={(e)=>setEmail(e.target.value)}
  disabled={mode !== 'coach-new'}   // ✅ μόνο στο coach-new editable
  className={"w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm " + (mode !== 'coach-new' ? "opacity-80 cursor-not-allowed" : "")}
/>

          </div>

          {/* Password fields visibility */}
{(mode === 'signup' || mode === 'edit-self' || mode === 'coach-new') && (
  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
    {mode === 'edit-self' && (
      <div className="md:col-span-2">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={changePassword}
            onChange={(e) => setChangePassword(e.target.checked)}
            className="accent-zinc-600"
          />
          Change password
        </label>
      </div>
    )}

    {(mode === 'signup' || mode === 'coach-new' || changePassword) && (
      <>
        <div>
          <label className="block text-xs mb-1 text-zinc-400">Password (≥6)</label>
          <div className="relative">
            <input
              type={showPw1 ? 'text' : 'password'}
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw1((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70 hover:opacity-100"
            >
              {showPw1 ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1 text-zinc-400">Confirm</label>
          <div className="relative">
            <input
              type={showPw2 ? 'text' : 'password'}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw2((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70 hover:opacity-100"
            >
              {showPw2 ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
      </>
    )}
  </div>
)}

        </section>

        {/* SECTION: Profile */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium mb-3 text-zinc-300">Profile</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1 text-zinc-400">First name</label>
              <input value={firstName} onChange={(e)=>setFirstName(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Last name</label>
              <input value={lastName} onChange={(e)=>setLastName(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Nickname</label>
              <input value={nickname} onChange={(e)=>setNickname(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Team</label>
              <input value={teamName} onChange={(e)=>setTeamName(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">DOB</label>
              <input type="date" value={dob} onChange={(e)=>setDob(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Phone</label>
              <input value={phone} onChange={(e)=>setPhone(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Gender</label>
              <select value={gender} onChange={(e)=>setGender(e.target.value as any)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm">
                <option value="">—</option>
                <option value="male">male</option>
                <option value="female">female</option>
                <option value="other">other</option>
                <option value="prefer_not_say">prefer_not_say</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Height (cm)</label>
              <input inputMode="numeric" value={heightCm} onChange={(e)=>setHeightCm(e.target.value.replace(/\D/g,''))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Weight (kg)</label>
              <input inputMode="numeric" value={weightKg} onChange={(e)=>setWeightKg(e.target.value.replace(/\D/g,''))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Years of experience</label>
              <input inputMode="numeric" value={years} onChange={(e)=>setYears(e.target.value.replace(/\D/g,''))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs mb-1 text-zinc-400">Notes</label>
              <textarea value={notes} onChange={(e)=>setNotes(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" rows={3} />
            </div>
          </div>
        </section>

        {/* SECTION: Emergency & Role */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-medium mb-3 text-zinc-300">Emergency & role</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Emergency name</label>
              <input value={emName} onChange={(e)=>setEmName(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs mb-1 text-zinc-400">Emergency phone</label>
              <input value={emPhone} onChange={(e)=>setEmPhone(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            </div>

           {(mode === 'coach-new' || mode === 'coach-edit' || (mode === 'edit-self' && iAmCoach)) && (
      <div className="md:col-span-2">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={isCoachFlag}
            onChange={(e)=>setIsCoachFlag(e.target.checked)}
            className="accent-zinc-600"
          />
          Coach
        </label>
      </div>
    )}
          </div>
        </section>

        <div className="flex gap-3">
          <button disabled={!canSubmit || busy}
            className="rounded-md bg-white/10 px-4 py-2 text-sm disabled:opacity-50">
            Save
          </button>
          {msg && <p className="text-sm text-red-400">{msg}</p>}
        </div>
      </form>
    </main>
  );
}
