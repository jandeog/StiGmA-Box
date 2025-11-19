'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_say';
type Mode = 'signup' | 'edit-self' | 'coach-edit' | 'coach-new';

type Props = {
  initialEmail: string;
  redirect: string;
  targetId: string | null;
  createNew: boolean;
};

export default function AddAthleteClient({
  initialEmail,
  redirect,
  targetId,
  createNew,
}: Props) {
  const router = useRouter();

  const [acceptRules, setAcceptRules] = useState(false);
  const [mode, setMode] = useState<Mode>('signup');
  const [myId, setMyId] = useState<string | null>(null);
  const [iAmCoach, setIAmCoach] = useState(false);

  // account fields
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
  const [credits, setCredits] = useState('0');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ---- setup ----
  useEffect(() => {
    let alive = true;
    (async () => {
      if (initialEmail) {
        setMode('signup');
        setEmail(initialEmail);
        return;
      }

      const meRes = await fetch('/api/me', { cache: 'no-store' });
      if (!meRes.ok) return;
      const j = await meRes.json();
      const me = j?.me ?? null;
      if (!me || !alive) return;

      setMyId(me.id);
      setIAmCoach(!!me.is_coach);
      setMode('edit-self');

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
      setCredits(me.credits != null ? String(me.credits) : '0');
    })();
    return () => {
      alive = false;
    };
  }, [initialEmail, targetId, createNew]);

  const needsPassword =
    mode === 'signup' ||
    mode === 'coach-new' ||
    (mode === 'edit-self' && changePassword);

  const canSubmit = useMemo(() => {
    if (busy || !email) return false;
    if (mode === 'signup' && !acceptRules) return false;
    if (needsPassword) return pw1.length >= 6 && pw1 === pw2;
    return true;
  }, [busy, email, needsPassword, pw1, pw2, mode, acceptRules]);

  function toNonNegativeInt(v: string) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      // --- mandatory checks ---
      if (mode === 'signup') {
        if (!email.trim()) throw new Error('Email is required.');
        if (pw1.length < 6) throw new Error('Password must be at least 6 characters.');
        if (pw1 !== pw2) throw new Error('Passwords do not match.');
        if (!firstName.trim() || !lastName.trim())
          throw new Error('First and last name are required.');
        if (!phone.trim()) throw new Error('Phone is required.');
        if (!emName.trim() || !emPhone.trim())
          throw new Error('Emergency role and phone are required.');
        if (!acceptRules) throw new Error('You must accept the gym rules.');
      }

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
        acceptRules: mode === 'signup' ? true : undefined,
        terms_version: 1,
      };

      if (iAmCoach) payload.is_coach = isCoachFlag || undefined;
      if (iAmCoach) payload.credits = toNonNegativeInt(credits);
      if (needsPassword) payload.password = pw1;

      const r = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let j: any = null;
      try {
        j = await r.json();
      } catch {
        j = null;
      }

      if (!r.ok) throw new Error(j?.error || `Error (HTTP ${r.status})`);

      const badge = nickname || `${firstName[0]}${lastName[0]}`.toUpperCase();
      window.dispatchEvent(new CustomEvent('header:updateName', { detail: badge }));
      window.dispatchEvent(new CustomEvent('credits:refresh'));

      if (j?.role === 'coach') router.replace('/athletes');
      else router.replace(redirect || '/schedule');
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  // ---- UI ----
  return (
    <main className="max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-semibold mb-6">
        {mode === 'signup'
          ? 'Complete your profile'
          : mode === 'coach-edit'
          ? 'Edit athlete'
          : mode === 'coach-new'
          ? 'Create athlete'
          : 'Your settings'}
      </h1>

      <form className="space-y-6" onSubmit={onSubmit}>
        {/* Account */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
          <h2 className="text-sm font-medium">Account</h2>

          {/* Email */}
          <div>
            <label className="block text-xs mb-1 text-zinc-400">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === 'edit-self' || mode === 'coach-edit'}
              autoComplete="off"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm"
            />
          </div>

          {/* Password fields */}
          {(mode === 'signup' || mode === 'coach-new' || changePassword) && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col">
                <label className="text-xs text-zinc-400 mb-1">
                  Password (≥6) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                <input
                  type={showPw1 ? 'text' : 'password'}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw1((v) => !v)}
                  className="px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800 text-xs"
                >
                  {showPw1 ? 'Hide' : 'Show'}
                </button>
              </div>
              </div>

              <div className="flex flex-col">
                <label className="text-xs text-zinc-400 mb-1">
                  Confirm <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                <input
                  type={showPw2 ? 'text' : 'password'}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  className="px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800 text-xs"
                >
                  {showPw2 ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            </div>
          )}

{/* Rules */}
{mode === 'signup' && (
  <div className="mt-3">
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={acceptRules}
        onChange={(e) => setAcceptRules(e.target.checked)}
        className="accent-yellow-500"
      />
      <span className="text-xs text-zinc-300 whitespace-nowrap">
        I accept the gym rules.
      </span>
    </label>

    <ol className="mt-2 list-decimal list-inside text-[11px] text-zinc-400 space-y-1">
      <li>Membership renewal must be completed before the previous one expires.</li>
      <li>Class booking allowed up to 1 hour before class start, not more than 24 hours in advance.</li>
      <li>Scores must be submitted before next training day.</li>
      <li>Put away your equipment before leaving.</li>
      <li>If a class is full, join the waiting list (2 spots).</li>
      <li>Cancel at least 1 hour before class start to avoid losing a credit.</li>
      <li>Coach instructions must be followed to prevent injury.</li>
      <li>Always have fun!</li>
    </ol>
  </div>
)}



        </section>

        {/* Profile */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <h2 className="text-sm font-medium">Profile</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              placeholder="First name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="placeholder-red-400 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
            />
            <input
              placeholder="Last name *"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="placeholder-red-400 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
            />
            <input placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Team" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input
              placeholder="Phone *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="placeholder-red-400 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
            />
            <select value={gender} onChange={(e) => setGender(e.target.value as Gender | '')} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm">
              <option value="">Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_say">Prefer not to say</option>
            </select>
            <input placeholder="Height (cm)" value={heightCm} onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, ''))} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Weight (kg)" value={weightKg} onChange={(e) => setWeightKg(e.target.value.replace(/\D/g, ''))} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Years of experience" value={years} onChange={(e) => setYears(e.target.value.replace(/\D/g, ''))} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Credits" value={credits} onChange={(e) => setCredits(e.target.value.replace(/\D/g, ''))} disabled={!iAmCoach} className={'rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm ' + (!iAmCoach ? 'opacity-80 cursor-not-allowed' : '')} />
          </div>
          <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
        </section>

        {/* Emergency */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <h2 className="text-sm font-medium">Emergency Contact <span className="text-red-500">*</span> </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input placeholder="Emergency Role *" value={emName} onChange={(e) => setEmName(e.target.value)} className="placeholder-red-400 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Emergency Phone *" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} className="placeholder-red-400 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
          </div>
        </section>

        <div className="flex gap-3 items-center">
          <button type="submit" disabled={!canSubmit || busy} className="rounded-md bg-white/10 px-4 py-2 text-sm disabled:opacity-50">
            Save
          </button>
          {msg && <p className="text-sm text-red-400">{msg}</p>}
        </div>
      </form>
    </main>
  );
}
