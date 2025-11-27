'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AthletePhotoInput from '@/components/AthletePhotoInput';


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
const [photoFile, setPhotoFile] = useState<File | null>(null);
const [photoUrl, setPhotoUrl] = useState<string | null>(null); // for existing photo later
  // account fields
  const [removedExistingPhoto, setRemovedExistingPhoto] = useState(false);
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
const [lastCreditsUpdate, setLastCreditsUpdate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ---- setup ----
function formatLastCreditsUpdate(value: string | null) {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

  
useEffect(() => {
  let alive = true;

  async function run() {
    setMsg(null);

    // 1) Pure signup from email link – only when NOT creating a new athlete as coach
    if (initialEmail && !createNew) {
      if (!alive) return;
      setMode('signup');
      setEmail(initialEmail);
      if (initialEmRole) setEmName(initialEmRole);
      if (initialEmPhone) setEmPhone(initialEmPhone);
      return;
    }

    // 2) Who am I?
    const meRes = await fetch('/api/me', { cache: 'no-store' });
    const j = meRes.ok ? await meRes.json() : { me: null };
    const me = j?.me || null;

    if (!alive) return;

    const amCoach = !!me?.is_coach;
    setIAmCoach(amCoach);
    setMyId(me?.id ?? null);

    // 3) Coach editing an existing athlete
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
       setLastCreditsUpdate(a.last_credits_update ?? null);
      setPhotoUrl(a.photo_url ? `${a.photo_url}?v=${Date.now()}` : null);
setPhotoFile(null);
setRemovedExistingPhoto(false);
      setRemovedExistingPhoto(false);
      return;
    }

// 4) Coach creating a NEW athlete (from + Add)
if (amCoach && createNew && !targetId) {
  setMode('coach-new');

  // Clear all fields – fresh form
  setAcceptRules(false);
  setEmail('');
  setPw1('');
  setPw2('');
  setShowPw1(false);
  setShowPw2(false);
  setChangePassword(false);

  setFirstName('');
  setLastName('');
  setNickname('');
  setTeamName('');
  setDob('');
  setPhone('');
  setGender('');
  setHeightCm('');
  setWeightKg('');
  setYears('');
  setNotes('');
  setEmName(initialEmRole || '');
  setEmPhone(initialEmPhone || '');
  setIsCoachFlag(false);
  setCredits('0');
setRemovedExistingPhoto(false);
setPhotoFile(null);
setPhotoUrl(null);


  return;
}


    // 5) Default: edit myself
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
    setLastCreditsUpdate(me?.last_credits_update ?? null)
    setPhotoUrl(me?.photo_url ? `${me.photo_url}?v=${Date.now()}` : null);
setPhotoFile(null);
setRemovedExistingPhoto(false);
  }

  run();
  return () => {
    alive = false;
  };
}, [initialEmail, initialEmRole, initialEmPhone, targetId, createNew]);

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
  async function compressImage(file: File, maxSize = 600, quality = 0.7): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // keep aspect ratio, scale down if needed
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > width && height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          const compressed = new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
            type: 'image/jpeg',
          });
          resolve(compressed);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

async function uploadPhotoFor(athleteId?: string | null) {
  if (!photoFile) return;

  let fileToUpload = photoFile;
  if (photoFile.size > 200 * 1024) {
    fileToUpload = await compressImage(photoFile, 600, 0.7);
  }

  const form = new FormData();
  form.append('file', fileToUpload);
  form.append('filename', fileToUpload.name || 'photo.jpg');

  const qs = athleteId ? `?id=${encodeURIComponent(athleteId)}` : '';
  const r = await fetch(`/api/athletes/upload-photo${qs}`, {
    method: 'POST',
    body: form,
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || 'Failed to upload photo');

  if (j.url) {
    // add cache-buster so mobile doesn’t use stale cached image
    setPhotoUrl(`${j.url}?t=${Date.now()}`);
  
  }
    setPhotoFile(null);
  setRemovedExistingPhoto(false);
}


async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setMsg(null);
  if (busy) return;

  try {
    setBusy(true);

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

  if (photoFile) {
    await uploadPhotoFor(targetId);
  } else if (removedExistingPhoto) {
    await fetch(`/api/athletes/upload-photo?id=${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
    });
  }

if (typeof window !== 'undefined') {
  window.location.href = '/athletes';
} else {
  router.replace('/athletes');
}
return;

    }

    // ========= COACH CREATES A NEW ATHLETE =========
    if (mode === 'coach-new' && iAmCoach) {
      const payload: any = {
        ...base,
        email,
        credits: numOrNull(credits) ?? 0,
        is_coach: isCoachFlag,
      };

      if (pw1.length < 6) throw new Error('Password must be at least 6 characters.');
      if (pw1 !== pw2) throw new Error('Passwords do not match.');
      payload.password = pw1;

      const r = await fetch('/api/athletes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        cache: 'no-store',
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Failed to create athlete (HTTP ${r.status})`);

  const newId = j?.athlete?.id as string | undefined;

  if (photoFile && newId) {
    await uploadPhotoFor(newId);
  } else if (removedExistingPhoto && newId) {
    await fetch(`/api/athletes/upload-photo?id=${encodeURIComponent(newId)}`, {
      method: 'DELETE',
    });
  }

if (typeof window !== 'undefined') {
  window.location.href = '/athletes';
} else {
  router.replace('/athletes');
}
return;

}

    // ========= SIGNUP or EDIT-SELF (current user) =========
    const payload: any = {
      ...base,
      email,
      acceptRules: mode === 'signup' ? true : undefined,
    };

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

    // Upload photo for myself (new signup or edit-self)
if (photoFile) {
  await uploadPhotoFor(); // uses session
} else if (removedExistingPhoto) {
  await fetch('/api/athletes/upload-photo', { method: 'DELETE' });
}


    const badge =
      nickname || (firstName && lastName ? `${firstName[0]}${lastName[0]}`.toUpperCase() : '');
    if (badge) window.dispatchEvent(new CustomEvent('header:updateName', { detail: badge }));
    window.dispatchEvent(new CustomEvent('credits:refresh'));

if (typeof window !== 'undefined') {
  if (j?.role === 'coach') {
    window.location.href = '/athletes';
  } else {
    window.location.href = redirect || '/schedule';
  }
} else {
  if (j?.role === 'coach') {
    router.replace('/athletes');
  } else {
    router.replace(redirect || '/schedule');
  }
}

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
<AthletePhotoInput
  value={photoFile}
  initialUrl={photoUrl}
  onChange={(file) => {
    setPhotoFile(file);
    if (file) {
      setRemovedExistingPhoto(false); // new photo, so no “removed existing”
    }
  }}
  onRemoveExisting={() => {
    setRemovedExistingPhoto(true);
    setPhotoFile(null);
    setPhotoUrl(null);
  }}
/>

  <div className="grid gap-4 md:grid-cols-2">
    {/* First name */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">
        First name <span className="text-red-500">*</span>
      </label>
      <input
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>

    {/* Last name */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">
        Last name <span className="text-red-500">*</span>
      </label>
      <input
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>

    {/* Nickname */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Nickname</label>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>

    {/* Team */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Team</label>
      <input
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>

    {/* DOB */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Date of birth</label>
      <input
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>

    {/* Phone (required) */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">
        Phone <span className="text-red-500">*</span>
      </label>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>

    {/* Gender */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Gender</label>
      <select
        value={gender}
        onChange={(e) => setGender(e.target.value as any)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      >
        <option value="">—</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="other">Other</option>
        <option value="prefer_not_say">Prefer not to say</option>
      </select>
    </div>

    {/* Height / Weight / Years */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Height (cm)</label>
      <input
        value={heightCm}
        onChange={(e) => setHeightCm(e.target.value.replace(/\D/g, ''))}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Weight (kg)</label>
      <input
        value={weightKg}
        onChange={(e) => setWeightKg(e.target.value.replace(/\D/g, ''))}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Years of experience</label>
      <input
        value={years}
        onChange={(e) => setYears(e.target.value.replace(/\D/g, ''))}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>

    {/* Credits (coach only) */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Credits</label>
      <input
        value={credits}
        onChange={(e) => setCredits(e.target.value.replace(/\D/g, ''))}
        disabled={!iAmCoach}
        className={
          'w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm ' +
          (!iAmCoach ? 'opacity-80 cursor-not-allowed' : '')
        }
      />
    </div>
        {/* Last credits renewal (read-only) */}
    <div>
      <label className="block text-xs mb-1 text-zinc-400">Last credits renewal</label>
      <input
        value={formatLastCreditsUpdate(lastCreditsUpdate)}
        disabled
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm opacity-80 cursor-not-allowed"
      />
    </div>

        {/* Promote to coach (visible only for coaches when editing/creating) */}
    {iAmCoach && (mode === 'coach-edit' || mode === 'coach-new') && (
      <div className="flex items-center gap-2 md:col-span-2">
        <input
          type="checkbox"
          checked={isCoachFlag}
          onChange={(e) => setIsCoachFlag(e.target.checked)}
          className="h-4 w-4 accent-emerald-500"
        />
        <span className="text-xs text-zinc-300">
          Coach account (can manage schedule, athletes, etc.)
        </span>
      </div>
    )}

  </div>

  {/* Notes */}
  <div>
    <label className="block text-xs mb-1 text-zinc-400">Notes</label>
    <textarea
      rows={3}
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
    />
  </div>
</section>

{/* Emergency */}
<section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
  <h2 className="text-sm font-medium">
    Emergency Contact <span className="text-red-500">*</span>
  </h2>
  <div className="grid gap-4 md:grid-cols-2">
    <div>
      <label className="block text-xs mb-1 text-zinc-400">
        Emergency Role <span className="text-red-500">*</span>
      </label>
      <input
        value={emName}
        onChange={(e) => setEmName(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>
    <div>
      <label className="block text-xs mb-1 text-zinc-400">
        Emergency Phone <span className="text-red-500">*</span>
      </label>
      <input
        value={emPhone}
        onChange={(e) => setEmPhone(e.target.value)}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm"
      />
    </div>
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
