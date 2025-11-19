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
      let me: any = null;
      if (meRes.ok) {
        const j = await meRes.json();
        me = j?.me ?? null;
      }

      if (!alive) return;
      const myIdLocal: string | null = me?.id ?? null;
      const iAmCoachLocal: boolean = !!me?.is_coach;
      setMyId(myIdLocal);
      setIAmCoach(iAmCoachLocal);

      if (createNew && iAmCoachLocal) {
        setMode('coach-new');
        return;
      }

      if (targetId && iAmCoachLocal && targetId !== myIdLocal) {
        setMode('coach-edit');
        const r = await fetch(`/api/athletes/${encodeURIComponent(targetId)}?t=${Date.now()}`, { cache: 'no-store' });
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
            setCredits(athlete.credits != null ? String(athlete.credits) : '0');
          }
        }
        return;
      }

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
        setCredits(me.credits != null ? String(me.credits) : '0');
      }
    })();
    return () => {
      alive = false;
    };
  }, [initialEmail, targetId, createNew]);

  // ---- helpers ----
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

  // ---- submit ----
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
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
          <div>
            <label className="block text-xs mb-1 text-zinc-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mode === 'edit-self' || mode === 'coach-edit'}
              autoComplete="off"
              className={
                'w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm ' +
                ((mode === 'edit-self' || mode === 'coach-edit')
                  ? 'opacity-80 cursor-not-allowed'
                  : '')
              }
            />
          </div>

          {(mode === 'signup' || mode === 'coach-new' || changePassword) && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs mb-1 text-zinc-400">Password (≥6)</label>
                <input
                  type={showPw1 ? 'text' : 'password'}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw1((v) => !v)}
                  className="text-xs mt-1 opacity-70 hover:opacity-100"
                >
                  {showPw1 ? 'Hide' : 'Show'}
                </button>
              </div>
              <div>
                <label className="block text-xs mb-1 text-zinc-400">Confirm</label>
                <input
                  type={showPw2 ? 'text' : 'password'}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  className="text-xs mt-1 opacity-70 hover:opacity-100"
                >
                  {showPw2 ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <label className="mt-2 block text-xs text-zinc-300 space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={acceptRules}
                  onChange={(e) => setAcceptRules(e.target.checked)}
                  className="accent-zinc-600"
                />
                <span>I accept the gym rules.</span>
              </div>
              <ol className="list-decimal list-inside text-[11px] text-zinc-400 space-y-1">
                <li>Membership renewal must be completed before the previous one expires.</li>
                <li>Class booking allowed up to 1 hour before class start, not more than 24 hours in advance.</li>
                <li>Scores must be submitted before next training day.</li>
                <li>Put away your equipment before leaving.</li>
                <li>If a class is full, join the waiting list (2 spots).</li>
                <li>Cancel at least 1 hour before class start to avoid losing a credit.</li>
                <li>Coach instructions must be followed to prevent injury.</li>
                <li>Always have fun!</li>
              </ol>
            </label>
          )}
        </section>

        {/* Profile */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <h2 className="text-sm font-medium">Profile</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Team" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
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
          <h2 className="text-sm font-medium">Emergency & role</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <input placeholder="Emergency name" value={emName} onChange={(e) => setEmName(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
            <input placeholder="Emergency phone" value={emPhone} onChange={(e) => setEmPhone(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm" />
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
