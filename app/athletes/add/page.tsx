// app/athletes/add/page.tsx
'use client';
import { Suspense } from 'react';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_say';

export type Athlete = {
  id: string;
  firstName: string;        // *
  lastName: string;         // *
  nickname?: string;        // optional
  teamName?: string;        // optional
  dob: string;              // * ISO (YYYY-MM-DD)
  email: string;            // *
  phone: string;            // *
  gender?: Gender;          // optional
  heightCm?: number;        // optional
  weightKg?: number;        // optional
  yearsOfExperience?: number; // optional (numeric)
  credits?: number;         // optional (numeric)
  notes?: string;           // optional
  emergencyName?: string;   // optional
  emergencyPhone?: string;  // optional
  isCoach?: boolean;        // coach flag
  createdAt: string;        // ISO
  updatedAt: string;        // ISO
};

type Session = {
  role: 'coach' | 'athlete';
  athleteId?: string;
};

const KEY_AUTH = 'auth:user';
const KEY_ATHLETES = 'athletes';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^[\d+\-\s()]{6,20}$/;

const field =
  "w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm field-muted " +
  "focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm";

function AddAthletePage() {
  const router = useRouter();
  const search = useSearchParams();
  const editId = search.get('id'); // αν υπάρχει, είμαστε σε EDIT mode

  // ---------------- Session (συγχρονισμένη αρχικοποίηση + listeners) ----------------
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = localStorage.getItem(KEY_AUTH);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const update = () => {
      try {
        const raw = localStorage.getItem(KEY_AUTH);
        setSession(raw ? (JSON.parse(raw) as Session) : null);
      } catch {
        setSession(null);
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_AUTH) update();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('auth:changed', update);
    update();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth:changed', update);
    };
  }, []);

  const isCoachUser = session?.role === 'coach';
  const isAthleteUser = session?.role === 'athlete';
  const myId = session?.athleteId;

  // ---------------- Storage / list ----------------
  const [athletes, setAthletes] = useState<Athlete[]>([]);

  // ---------------- Form state ----------------
  // required
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [dob, setDob]               = useState(''); // YYYY-MM-DD
  const [email, setEmail]           = useState('');
  const [phone, setPhone]           = useState('');

  // extra
  const [teamName, setTeamName]     = useState('');
  const [nickname, setNickname]     = useState('');
  const [years, setYears]           = useState<string>(''); // numeric input → number on save
  const [credits, setCredits]       = useState<string>(''); // numeric input → number on save
  const [gender, setGender]         = useState<Gender | ''>('');
  const [heightCm, setHeightCm]     = useState<string>('');
  const [weightKg, setWeightKg]     = useState<string>('');
  const [notes, setNotes]           = useState('');
  const [emName, setEmName]         = useState('');
  const [emPhone, setEmPhone]       = useState('');

  // Coach toggle (μόνο για coach user)
  const [isCoachFlag, setIsCoachFlag] = useState<boolean>(false);

  const [savedMsg, setSavedMsg]     = useState('');
  const [errors, setErrors]         = useState<Record<string, string>>({});

  // ---------------- Load athletes + prefill on edit ----------------
  useEffect(() => {
    const raw = localStorage.getItem(KEY_ATHLETES);
    const list = raw ? (JSON.parse(raw) as Athlete[]) : [];
    setAthletes(list);

    if (editId) {
      const ex = list.find((x) => x.id === editId);
      if (ex) {
        setFirstName(ex.firstName || '');
        setLastName(ex.lastName || '');
        setDob(ex.dob || '');
        setEmail(ex.email || '');
        setPhone(ex.phone || '');
        setTeamName(ex.teamName || '');
        setNickname(ex.nickname || '');
        setYears(ex.yearsOfExperience?.toString() || '');
        setCredits(ex.credits?.toString() || '');
        setGender((ex.gender ?? '') as Gender | '');
        setHeightCm(ex.heightCm?.toString() || '');
        setWeightKg(ex.weightKg?.toString() || '');
        setNotes(ex.notes || '');
        setEmName(ex.emergencyName || '');
        setEmPhone(ex.emergencyPhone || '');
        setIsCoachFlag(!!ex.isCoach);
      }
    } else {
      // reset form σε add mode
      setFirstName(''); setLastName(''); setDob('');
      setEmail(''); setPhone('');
      setTeamName(''); setNickname('');
      setYears(''); setCredits('');
      setGender(''); setHeightCm(''); setWeightKg('');
      setNotes(''); setEmName(''); setEmPhone('');
      setIsCoachFlag(false);
      setErrors({});
    }
  }, [editId]);

  // athlete: δεν επιτρέπεται να επεξεργαστεί άλλον
  const editingSomeoneElse = !!editId && myId && myId !== editId;
  useEffect(() => {
    if (isAthleteUser && editingSomeoneElse) {
      alert('You can only edit your own profile.');
      router.replace('/athletes');
    }
  }, [isAthleteUser, editingSomeoneElse, router]);

  // Κλειδώνουν τα 4 πεδία για athlete όταν κάνει self-edit
  const lockIdentityFields = isAthleteUser && !!editId;

  const fullName = useMemo(
    () => [firstName.trim(), lastName.trim()].filter(Boolean).join(' '),
    [firstName, lastName]
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Required';
    if (!lastName.trim())  e.lastName = 'Required';
    if (!dob)              e.dob = 'Required';
    if (!emailRe.test(email.trim())) e.email = 'Invalid email';
    if (!phoneRe.test(phone.trim())) e.phone = 'Invalid phone';
    if (years && isNaN(Number(years))) e.years = 'Must be a number';
    if (credits && isNaN(Number(credits))) e.credits = 'Must be a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveList = (arr: Athlete[]) => {
    setAthletes(arr);
    localStorage.setItem(KEY_ATHLETES, JSON.stringify(arr));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Αν ο τρέχων χρήστης είναι coach και ορίζει coach flag → επιβεβαίωση
    if (isCoachUser && isCoachFlag) {
      const ok = window.confirm('Are you sure that this athlete is a Coach?');
      if (!ok) return;
    }

    const now = new Date().toISOString();

    if (!editId) {
      // ---------------- CREATE ----------------
      // αποφυγή duplicates (email ή ίδιο full name)
      const exists = athletes.some(
        (x) =>
          x.email.toLowerCase() === email.trim().toLowerCase() ||
          ([x.firstName, x.lastName].join(' ').toLowerCase() === fullName.toLowerCase())
      );
      if (exists) {
        setSavedMsg('⚠️ Athlete already exists (same email or name).');
        setTimeout(() => setSavedMsg(''), 2000);
        return;
      }

      const rec: Athlete = {
        id: crypto.randomUUID(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        nickname: nickname.trim() || undefined,
        teamName: teamName.trim() || undefined,
        dob,
        email: email.trim(),
        phone: phone.trim(),
        gender: gender || undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        weightKg: weightKg ? Number(weightKg) : undefined,
        yearsOfExperience: years ? Number(years) : undefined,
        credits: credits ? Number(credits) : undefined,
        notes: notes || undefined,
        emergencyName: emName || undefined,
        emergencyPhone: emPhone || undefined,
        isCoach: isCoachUser ? (isCoachFlag || undefined) : undefined,
        createdAt: now,
        updatedAt: now,
      };

      const next = [rec, ...athletes].sort(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      );
      saveList(next);

      setSavedMsg(`✅ Saved: ${rec.firstName} ${rec.lastName}${rec.isCoach ? ' (Coach)' : ''}`);
      setTimeout(() => setSavedMsg(''), 1600);

      // clear form
      setFirstName(''); setLastName(''); setDob('');
      setEmail(''); setPhone('');
      setTeamName(''); setNickname('');
      setYears(''); setCredits('');
      setGender(''); setHeightCm(''); setWeightKg('');
      setNotes(''); setEmName(''); setEmPhone('');
      setIsCoachFlag(false);
      setErrors({});
    } else {
      // ---------------- UPDATE ----------------
      const idx = athletes.findIndex((x) => x.id === editId);
      if (idx === -1) {
        alert('Athlete not found.');
        return;
      }
      const existing = athletes[idx];

      let nextRec: Athlete;
      if (isAthleteUser) {
        // Athlete: μπορεί να αλλάξει ΟΛΑ εκτός από: first/last/email/phone/coach flag
        nextRec = {
          ...existing,
          // κλειδωμένα
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          phone: existing.phone,
          isCoach: existing.isCoach,
          // ελεύθερα
          teamName: teamName.trim() || undefined,
          nickname: nickname.trim() || undefined,
          dob,
          gender: gender || undefined,
          heightCm: heightCm ? Number(heightCm) : undefined,
          weightKg: weightKg ? Number(weightKg) : undefined,
          yearsOfExperience: years ? Number(years) : undefined,
          credits: credits ? Number(credits) : undefined,
          notes: notes || undefined,
          emergencyName: emName || undefined,
          emergencyPhone: emPhone || undefined,
          updatedAt: now,
        };
      } else {
        // Coach: full edit
        nextRec = {
          ...existing,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          teamName: teamName.trim() || undefined,
          nickname: nickname.trim() || undefined,
          dob,
          gender: gender || undefined,
          heightCm: heightCm ? Number(heightCm) : undefined,
          weightKg: weightKg ? Number(weightKg) : undefined,
          yearsOfExperience: years ? Number(years) : undefined,
          credits: credits ? Number(credits) : undefined,
          notes: notes || undefined,
          emergencyName: emName || undefined,
          emergencyPhone: emPhone || undefined,
          isCoach: isCoachFlag || undefined,
          updatedAt: now,
        };
      }

      const next = [...athletes];
      next[idx] = nextRec;
      // optional: διατήρησε ταξινόμηση
      next.sort(
        (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
      );
      saveList(next);

      // Αν επεξεργάστηκες τον εαυτό σου, συγχρόνισε το session role (coach/athlete)
      const authRaw = localStorage.getItem(KEY_AUTH);
      if (authRaw) {
        const auth = JSON.parse(authRaw) as { athleteId?: string; role: 'coach' | 'athlete' };
        const updated = next.find(a => a.id === editId);
        if (updated && auth.athleteId === updated.id) {
          const newRole: 'coach' | 'athlete' = updated.isCoach ? 'coach' : 'athlete';
          if (auth.role !== newRole) {
            localStorage.setItem(KEY_AUTH, JSON.stringify({ ...auth, role: newRole }));
            window.dispatchEvent(new Event('auth:changed'));
          }
        }
      }

      setSavedMsg(`✅ Updated: ${nextRec.firstName} ${nextRec.lastName}${nextRec.isCoach ? ' (Coach)' : ''}`);
      setTimeout(() => setSavedMsg(''), 1600);
    }
  };

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{editId ? 'Edit Athlete' : 'Add Athlete'}</h1>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Identity */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              First name <span className="text-red-400">*</span>
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={lockIdentityFields}
              className={field}
              placeholder="e.g. Giannis"
            />
            {errors.firstName && <div className="text-xs text-red-400 mt-1">{errors.firstName}</div>}
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Last name <span className="text-red-400">*</span>
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={lockIdentityFields}
              className={field}
              placeholder="e.g. Antetokounmpo"
            />
            {errors.lastName && <div className="text-xs text-red-400 mt-1">{errors.lastName}</div>}
          </div>
        </div>

        {/* Team + Nickname */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Team name</label>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className={field}
              placeholder="e.g. Red"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Nickname</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={field}
              placeholder="e.g. Air"
            />
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={lockIdentityFields}
              className={field}
              placeholder="name@example.com"
            />
            {errors.email && <div className="text-xs text-red-400 mt-1">{errors.email}</div>}
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Phone <span className="text-red-400">*</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={lockIdentityFields}
              className={field}
              placeholder="69..."
            />
            {errors.phone && <div className="text-xs text-red-400 mt-1">{errors.phone}</div>}
          </div>
        </div>

        {/* DOB + Gender */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              Date of birth <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="`datepicker-white-icon ${field}`"
            />
            {errors.dob && <div className="text-xs text-red-400 mt-1">{errors.dob}</div>}
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | '')}
              className={field}
            >
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
            <input
              inputMode="numeric"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              className={field}
              placeholder="e.g. 182"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Weight (kg)</label>
            <input
              inputMode="numeric"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className={field}
              placeholder="e.g. 85"
            />
          </div>
        </div>

        {/* Experience (numeric) + Credits */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Years of experience</label>
            <input
              inputMode="numeric"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              className={field}
              placeholder="e.g. 3"
            />
            {errors.years && <div className="text-xs text-red-400 mt-1">{errors.years}</div>}
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Credits</label>
            <input
              inputMode="numeric"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className={field}
              placeholder="e.g. 10"
            />
            {errors.credits && <div className="text-xs text-red-400 mt-1">{errors.credits}</div>}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm mb-1 text-zinc-300">
            Notes (injuries, allergies, etc.)
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={field}
            placeholder="Optional info for the coach"
          />
        </div>

        {/* Emergency contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Emergency contact name</label>
            <input
              value={emName}
              onChange={(e) => setEmName(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Emergency contact phone</label>
            <input
              value={emPhone}
              onChange={(e) => setEmPhone(e.target.value)}
              className={field}
            />
          </div>
        </div>

        {/* Coach toggle (only for coach users) */}
        {isCoachUser && (
          <div className="pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isCoachFlag}
                onChange={(e) => setIsCoachFlag(e.target.checked)}
                className="h-4 w-4 accent-zinc-200"
              />
              <span>Coach</span>
            </label>
            <div className="text-xs text-zinc-500 mt-1">
              If checked, a confirmation will be shown before saving.
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm">
            {editId ? 'Save changes' : 'Save athlete'}
          </button>
          {savedMsg && <span className="text-sm text-zinc-300">{savedMsg}</span>}
        </div>
      </form>

      <hr className="my-6 border-zinc-800" />

      {/* μικρή λίστα για έλεγχο */}
      <h2 className="text-lg font-semibold mb-2">Athletes (demo)</h2>
      <div className="border border-zinc-800 rounded">
        {athletes.length === 0 ? (
          <div className="p-3 text-sm text-zinc-400">No athletes yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {athletes.map((a) => (
              <li key={a.id} className="p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">
                    {a.firstName} {a.lastName}
                    {a.nickname ? <span className="text-zinc-400"> ({a.nickname})</span> : null}
                    {a.teamName ? <span className="text-zinc-500 text-xs ml-2">[{a.teamName}]</span> : null}
                    {a.isCoach ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-emerald-700 text-emerald-300">
                        Coach
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500">{a.email} • {a.phone}</div>
                </div>
                <div className="text-xs text-zinc-500">{a.dob}</div>
              </li>
            ))}
          </ul>
          
        )}
        
      </div>
      
    </section>
    
    
  );
  
}
export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-zinc-400">Loading…</div>}>
      <AddAthletePage />
    </Suspense>
  );
}
