// app/wod/page.tsx
'use client';

import { useEffect, useState } from 'react';


type ScoringType = 'for_time' | 'amrap' | 'emom';

type StrengthPart = {
  title: string;
  description: string;
  scoreHint: string;
  recordScore: boolean;
};

type WOD = {
  date: string; // stored as YYYY-MM-DD
  // Part 1 — Strength / Skills
  strength?: StrengthPart;

  // Main WOD
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string; // e.g. "12:00"
  recordMainScore: boolean;
};

const defaultWOD = (date: string) => ({
  date,
  strength: { title: '', description: '', scoreHint: '', recordScore: false },
  title: '',
  description: '',
  scoring: 'for_time' as ScoringType,
  timeCap: '',
  recordMainScore: true,
});

// Κλείδωμα ρύθμισης (read-only UI)
const isLocked = true;

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDDMMYYYY = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

export default function WodPage() {
  const [wod, setWod] = useState<WOD>({
    date: todayStr(),
    strength: { title: '', description: '', scoreHint: '', recordScore: false },
    title: '',
    description: '',
    scoring: 'for_time',
    timeCap: '',
    recordMainScore: true,
  });
  const [savedMsg, setSavedMsg] = useState('');

  // Load from localStorage (migrates older saves)
useEffect(() => {
  const key = `wod:${wod.date}`;
  const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<WOD>;
      setWod({
        date: parsed.date || wod.date,
        strength: {
          title: parsed.strength?.title ?? '',
          description: parsed.strength?.description ?? '',
          scoreHint: parsed.strength?.scoreHint ?? '',
          recordScore: parsed.strength?.recordScore ?? false,
        },
        title: parsed.title ?? '',
        description: parsed.description ?? '',
        scoring: (parsed.scoring as ScoringType) ?? 'for_time',
        timeCap: parsed.timeCap ?? '',
        recordMainScore: parsed.recordMainScore ?? true,
      });
      return;
    } catch {}
  }
  setWod({
    date: wod.date,
    strength: { title: '', description: '', scoreHint: '', recordScore: false },
    title: '',
    description: '',
    scoring: 'for_time',
    timeCap: '',
    recordMainScore: true,
  });
}, [wod.date]); // ✅ fixed-length array (1 item)



  const saveWod = () => {
    const key = `wod:${wod.date}`;
    localStorage.setItem(key, JSON.stringify(wod));
    setSavedMsg('✅ Saved for this date');
    setTimeout(() => setSavedMsg(''), 1600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wod.title.trim()) {
      setSavedMsg('⚠️ Add a title for the Main WOD');
      return;
    }
    saveWod();
  };

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">WOD (demo)</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date — standalone */}
        <div>
          <label className="block text-sm mb-1 text-zinc-300">Date</label>
          <input
          disabled={isLocked}
            type="date"
            lang="en-GB"
            value={wod.date}
            onChange={(e) => setWod((s) => ({ ...s, date: e.target.value }))}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </div>

        {/* Strength / Skills */}
        <h2 className="text-lg font-semibold">Strength / Skills</h2>
        <div className="border border-zinc-800 rounded p-3 bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Title</label>
              <input
              disabled={isLocked}
                value={wod.strength?.title || ''}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    strength: {
                      ...(s.strength || { description: '', scoreHint: '', recordScore: false }),
                      title: e.target.value,
                    },
                  }))
                }
                placeholder="e.g. Back Squat"
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-zinc-300">Score (hint)</label>
              <input
              disabled={isLocked}
                value={wod.strength?.scoreHint || ''}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    strength: {
                      ...(s.strength || { title: '', description: '', recordScore: false }),
                      scoreHint: e.target.value,
                    },
                  }))
                }
                placeholder="e.g. 5x5 @kg or EMOM 10’"
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">Description</label>
            <textarea
            disabled={isLocked}
              rows={4}
              value={wod.strength?.description || ''}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: {
                    ...(s.strength || { title: '', scoreHint: '', recordScore: false }),
                    description: e.target.value,
                  },
                }))
              }
              placeholder="Sets, reps, tempo, rest, cues…"
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
          </div>

          {/* Checkbox INSIDE the box */}
          <div className="mt-3 flex items-center gap-2">
            <input
            disabled={isLocked}
              id="strength-record"
              type="checkbox"
              checked={!!wod.strength?.recordScore}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: {
                    ...(s.strength || { title: '', description: '', scoreHint: '' }),
                    recordScore: e.target.checked,
                  },
                }))
              }
              className="h-4 w-4 accent-zinc-200"
            />
            <label htmlFor="strength-record" className="text-sm text-zinc-300">
              Record score for Strength / Skills
            </label>
          </div>
        </div>

        {/* Main WOD */}
        <h2 className="text-lg font-semibold">Main WOD</h2>
        <div className="border border-zinc-800 rounded p-3 bg-zinc-900">
          {/* Title + Scoring side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Title</label>
              <input
                placeholder="e.g. Fran / EMOM 12’ / 5 Rounds …"
                value={wod.title}
                onChange={(e) => setWod((s) => ({ ...s, title: e.target.value }))}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-zinc-300">Scoring</label>
              <select
              disabled={isLocked}
                value={wod.scoring}
                onChange={(e) => setWod((s) => ({ ...s, scoring: e.target.value as ScoringType }))}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              >
                <option value="for_time">For Time</option>
                <option value="amrap">AMRAP</option>
                <option value="emom">EMOM</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">Description / Rep scheme</label>
            <textarea
            disabled={isLocked}
              rows={6}
              placeholder={`e.g.\n21-15-9 Thrusters (42.5/30) & Pull-ups\nTime cap: 8:00`}
              value={wod.description}
              onChange={(e) => setWod((s) => ({ ...s, description: e.target.value }))}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
          </div>

{/* Time cap + checkbox INSIDE the box (checkbox below) */}
<div className="mt-3">
  <label className="block text-sm mb-1 text-zinc-300">Time cap</label>
  <input
  disabled={isLocked}
    placeholder="e.g. 12:00"
    value={wod.timeCap}
    onChange={(e) => setWod((s) => ({ ...s, timeCap: e.target.value }))}
    className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
  />
  <div className="mt-3 flex items-center gap-2">
    <input
    disabled={isLocked}
      id="main-record"
      type="checkbox"
      checked={wod.recordMainScore}
      onChange={(e) => setWod((s) => ({ ...s, recordMainScore: e.target.checked }))}
      className="h-4 w-4 accent-zinc-200"
    />
    <label htmlFor="main-record" className="text-sm text-zinc-300">
      Record score for Main WOD
    </label>
  </div>
</div>
        </div>

        <div className="flex items-center gap-2">
         <button
  type="submit"
  className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm opacity-60 cursor-not-allowed"
  disabled
  title="Read-only mode"
>
  Save
</button>
          {savedMsg && <span className="text-sm text-zinc-300">{savedMsg}</span>}
        </div>
      </form>

      <hr className="my-6 border-zinc-800" />

      <h2 className="text-lg font-semibold mb-2">Preview</h2>
      <div className="border border-zinc-800 rounded p-3 bg-zinc-900 space-y-4">
        <div className="text-sm text-zinc-400">{fmtDDMMYYYY(wod.date)}</div>

        {/* Strength / Skills preview */}
        <div>
          <div className="text-sm text-zinc-400">Strength / Skills</div>
          <div className="font-semibold">{wod.strength?.title || '—'}</div>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap">{wod.strength?.description || '—'}</div>
          <div className="text-sm text-zinc-400 mt-1">
            {wod.strength?.scoreHint ? `Score: ${wod.strength.scoreHint} • ` : ''}
            Record score: {wod.strength?.recordScore ? 'Yes' : 'No'}
          </div>
        </div>

        {/* Main WOD preview */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="text-sm text-zinc-400">Main WOD</div>
          <div className="text-xl font-bold">{wod.title || '—'}</div>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap mt-1">{wod.description || '—'}</div>
          <div className="text-sm text-zinc-400 mt-1">
            Scoring: {wod.scoring.toUpperCase()} {wod.timeCap ? `• Time cap: ${wod.timeCap}` : ''} • Record score: {wod.recordMainScore ? 'Yes' : 'No'}
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-400 mt-2">* Local-only storage (browser).</p>
    </section>
  );
}
