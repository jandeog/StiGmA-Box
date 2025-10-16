// app/wod/page.tsx
'use client';

import { useEffect, useState } from 'react';
import DateStepper from '@/components/DateStepper';

type ScoringType = 'for_time' | 'amrap' | 'emom';

type StrengthPart = {
  title: string;
  description: string;
  scoreHint: string;
  recordScore: boolean;
};

type WOD = {
  // NO date inside WOD state anymore — date is separate
  strength: StrengthPart;
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string;
  recordMainScore: boolean;
};

// Helpers
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDDMMYYYY = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

const defaultWOD = (): WOD => ({
  strength: { title: '', description: '', scoreHint: '', recordScore: false },
  title: '',
  description: '',
  scoring: 'for_time',
  timeCap: '',
  recordMainScore: true,
});

export default function WodPage() {
  // Date is independent so you can change it freely
  const [date, setDate] = useState<string>(todayStr());

  // WOD contents for the selected date
  const [wod, setWod] = useState<WOD>(defaultWOD());

  const [savedMsg, setSavedMsg] = useState('');
  const [locked, setLocked] = useState(false);

  const field =
  "w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm field-muted " +
  "focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm";

  // Load from localStorage when the date changes; reset to defaults if not found
  useEffect(() => {
    const key = `wod:${date}`;
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<WOD>;
        setWod({
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
    // default κενό για τη συγκεκριμένη date
    setWod(defaultWOD());
  }, [date]);

  // Save (kept even if locked for future unlock flow)
  const saveWod = () => {
    const key = `wod:${date}`;
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
    <section className="max-w-4xl mx-auto text-left">
      <h1 className="text-2xl font-bold mb-4">WOD</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date — standalone and ENABLED */}
        <div>
          <label className="block text-sm mb-1 text-zinc-300">Date</label>
          <DateStepper value={date} onChange={setDate} />
        </div>

        {/* Strength / Skills */}
        <h2 className="text-lg font-semibold">Strength / Skills</h2>
        <div className="border border-zinc-800 rounded p-3 bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Title</label>
              <input
                disabled={locked}
                value={wod.strength.title}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    strength: { ...s.strength, title: e.target.value },
                  }))
                }
                placeholder="e.g. Back Squat"
                className={field}
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-zinc-300">Score (hint)</label>
              <input
                disabled={locked}
                value={wod.strength.scoreHint}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    strength: { ...s.strength, scoreHint: e.target.value },
                  }))
                }
                placeholder="e.g. 5x5 @kg or EMOM 10’"
                className={field}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">Description</label>
            <textarea
              disabled={locked}
              rows={4}
              value={wod.strength.description}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: { ...s.strength, description: e.target.value },
                }))
              }
              placeholder="Sets, reps, tempo, rest, cues…"
              className={field}
            />
          </div>

          <div className="mt-3 inline-flex items-center gap-2">
            <input
              disabled={locked}
              id="strength-record"
              type="checkbox"
              checked={wod.strength.recordScore}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: { ...s.strength, recordScore: e.target.checked },
                }))
              }
              className="h-4 w-4 accent-zinc-200"
            />
            <label htmlFor="strength-record" className="text-sm text-zinc-300 whitespace-nowrap">
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
                disabled={locked}
                placeholder="e.g. Fran / EMOM 12’ / 5 Rounds …"
                value={wod.title}
                onChange={(e) => setWod((s) => ({ ...s, title: e.target.value }))}
                className={field}
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-zinc-300">Scoring</label>
              <select
                disabled={locked}
                value={wod.scoring}
                onChange={(e) => setWod((s) => ({ ...s, scoring: e.target.value as ScoringType }))}
                className={field}
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
              disabled={locked}
              rows={6}
              placeholder={`e.g.\n21-15-9 Thrusters (42.5/30) & Pull-ups\nTime cap: 8:00`}
              value={wod.description}
              onChange={(e) => setWod((s) => ({ ...s, description: e.target.value }))}
              className={field}
            />
          </div>

          {/* Time cap + checkbox */}
          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">Time cap</label>
            <input
              disabled={locked}
              placeholder="e.g. 12:00"
              value={wod.timeCap}
              onChange={(e) => setWod((s) => ({ ...s, timeCap: e.target.value }))}
              className={field}
            />
            <div className="mt-3 inline-flex items-center gap-2">
              <input
                disabled={locked}
                id="main-record"
                type="checkbox"
                checked={wod.recordMainScore}
                onChange={(e) => setWod((s) => ({ ...s, recordMainScore: e.target.checked }))}
                className="h-4 w-4 accent-zinc-200"
              />
              <label htmlFor="main-record" className="text-sm text-zinc-300 whitespace-nowrap">
                Record score for Main WOD
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className={`px-4 py-2 rounded border border-zinc-700 text-sm ${locked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-800'}`}
            disabled={locked}
            title={locked ? 'This date already has a saved WOD (locked)' : 'Save WOD for this date'}
          >
            Save
          </button>
          {savedMsg && <span className="text-sm text-zinc-300">{savedMsg}</span>}
        </div>
      </form>

      <hr className="my-6 border-zinc-800" />

      <h2 className="text-lg font-semibold mb-2">Preview</h2>
      <div className="border border-zinc-800 rounded p-3 bg-zinc-900 space-y-4">
        <div className="text-sm text-zinc-400">{fmtDDMMYYYY(date)}</div>

        {/* Strength / Skills preview */}
        <div>
          <div className="text-sm text-zinc-400">Strength / Skills</div>
          <div className="font-semibold">{wod.strength.title || '—'}</div>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap">{wod.strength.description || '—'}</div>
          <div className="text-sm text-zinc-400 mt-1">
            {wod.strength.scoreHint ? `Score: ${wod.strength.scoreHint} • ` : ''}
            Record score: {wod.strength.recordScore ? 'Yes' : 'No'}
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
