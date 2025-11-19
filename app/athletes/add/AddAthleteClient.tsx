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
    initialEmRole?: string;   // NEW
  initialEmPhone?: string;  // NEW
};
function numOrNull(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export default function AddAthleteClient({
  initialEmail,
  redirect,
  targetId,
  createNew,
    initialEmRole = '',       // NEW
  initialEmPhone = '',      // NEW
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

  async function run() {
    setMsg(null);

    // 1) Pure signup: if we have an initialEmail (OTP/callback), do signup mode first.
    if (initialEmail) {
      if (!alive) return;
      setMode('signup');
      setEmail(initialEmail);
      if (initialEmRole) setEmName(initialEmRole);
      if (initialEmPhone) setEmPhone(initialEmPhone);
      return;
    }

    // 2) Resolve who I am (to know if I'm a coach)
    const meRes = await fetch('/api/me', { cache: 'no-store' });
    const j = meRes.ok ? await meRes.json() : { me: null };
    const me = j?.me || null;

    if (!alive) return;

    const amCoach = !!me?.is_coach;
    setIAmCoach(amCoach);
    setMyId(me?.id ?? null);

    // 3) If I'm a coach and a targetId is present -> COACH EDIT takes priority.
    if (amCoach && targetId) {
      setMode('coach-edit');

      const r = await fetch(
        `/api/athletes/${encodeURIComponent(targetId)}?t=${Date.now()}`,
        { cache: 'no-store' }
      );
      const aj = r.ok ? await r.json() : { athlete: null };
      const a = aj?.athlete || null;

      if (!alive) return;
      if (!a) {
        setMsg('Athlete not found.');
        return;
      }

      // fill with target athlete
      setEmail(a.email || '');
      setFirstName(a.first_name || '');
      setLastName(a.last_name || '');
      setNickname(a.nickname || '');
      setTeamName(a.team_name || '');
      setDob(a.dob || '');
      setPhone(a.phone || '');
      setGender(a.gender || '');
      setHeightCm(a.height_cm ? String(a.height_cm) : '');
      setWeightKg(a.weight_kg ? String(a.weight_kg) : '');
      setYears(a.years_of_experience ? String(a.years_of_experience) : '');
      setNotes(a.notes || '');
      setEmName(a.emergency_name || '');
      setEmPhone(a.emergency_phone || '');
      setIsCoachFlag(!!a.is_coach);
      setCredits(a.credits != null ? String(a.credits) : '0');
      return;
    }

    // 4) Otherwise -> EDIT SELF (uses /api/me)
    setMode('edit-self');

    setEmail(me?.email || '');
    setFirstName(me?.first_name || '');
    setLastName(me?.last_name || '');
    setNickname(me?.nickname || '');
    setTeamName(me?.team_name || '');
    setDob(me?.dob || '');
    setPhone(me?.phone || '');
    setGender(me?.gender || '');
    setHeightCm(me?.height_cm ? String(me?.height_cm) : '');
    setWeightKg(me?.weight_kg ? String(me?.weight_kg) : '');
    setYears(me?.years_of_experience ? String(me?.years_of_experience) : '');
    setNotes(me?.notes || '');
    setEmName(me?.emergency_name || '');
    setEmPhone(me?.emergency_phone || '');
    setIsCoachFlag(!!me?.is_coach);
    setCredits(me?.credits != null ? String(me?.credits) : '0');
  }

  run();
  return () => { alive = false; };
}, [initialEmail, initialEmRole, initialEmPhone, targetId]);


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
  if (busy) return;

  try {
    setBusy(true);

    // Build common payload from form state
    const base: any = {
      first_name: firstName || null,
      last_name: lastName || null,
      nickname: nickname || null,
      team_name: teamName || null,
      dob: dob || null,
      phone: phone || null,
      gender: gender || null,
      height_cm: numOrNull(heightCm),
      weight_kg: numOrNull(weightKg),
      years_of_experience: numOrNull(years),
      notes: notes || null,
      emergency_name: emName || null,
      emergency_phone: emPhone || null,
    };

    // ========= COACH EDITS ANOTHER ATHLETE =========
    if (mode === 'coach-edit' && targetId) {
      // Only coaches can touch credits / is_coach
      if (iAmCoach) {
        base.credits = numOrNull(credits) ?? 0;
        base.is_coach = isCoachFlag;
      }

      const r = await fetch(`/api/athletes/${encodeURIComponent(targetId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(base),
        cache: 'no-store',
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Failed to save athlete (HTTP ${r.status})`);

      // Do NOT update header badge when editing others
      router.replace('/athletes');
      return;
    }

    // ========= SIGNUP or EDIT-SELF =========
    const payload: any = {
      ...base,
      email,                  // edit-self may allow changing email in your flow; if not, server will ignore
      acceptRules: mode === 'signup' ? true : undefined,
    };

    // Password only when required
    if (needsPassword) {
      if (pw1.length < 6) throw new Error('Password must be at least 6 characters.');
      if (pw1 !== pw2) throw new Error('Passwords do not match.');
      payload.password = pw1;
    }

    const r = await fetch('/api/auth/complete-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || `Error (HTTP ${r.status})`);

    // Update header badge only for self
    const badge = nickname || (firstName && lastName ? `${firstName[0]}${lastName[0]}`.toUpperCase() : '');
    if (badge) window.dispatchEvent(new CustomEvent('header:updateName', { detail: badge }));
    window.dispatchEvent(new CustomEvent('credits:refresh'));

    if (j?.role === 'coach') router.replace('/athletes');
    else router.replace(redirect || '/schedule');
  } catch (err: any) {
    setMsg(err.message || 'Failed to save');
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
