'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DateStepper from '@/components/DateStepper';

type ScoringType = 'for_time' | 'amrap' | 'emom' | 'max_load' | 'other';

type WodState = {
  dateISO: string;                // YYYY-MM-DD (local)
  // Strength / Skills
  strength: {
    title: string;
    description: string;
    scoreHint: string;
    recordScore: boolean;
  };
  // Main WOD
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string;
  recordMainScore: boolean;
};

type MainSuggestion = {
  title: string;
  description?: string | null;
  scoring?: ScoringType | null;
  timeCap?: string | null;
};

type StrengthSuggestion = {
  strengthTitle?: string | null;
  strengthDescription?: string | null;
  strengthScoreHint?: string | null;
};

const scoringOptions: { value: ScoringType; label: string }[] = [
  { value: 'for_time', label: 'For time' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'emom', label: 'EMOM' },
  { value: 'max_load', label: 'Max load' },
  { value: 'other', label: 'Other' },
];

async function getJSON<T = any>(url: string) {
  const r = await fetch(url, { cache: 'no-store' });
  const raw = await r.text();
  const j = raw ? JSON.parse(raw) : {};
  if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);
  return j as T;
}
async function postJSON<T = any>(url: string, body: any) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const raw = await r.text();
  const j = raw ? JSON.parse(raw) : {};
  if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);
  return j as T;
}

export default function WodPage() {
  // Date
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // WOD state
  const [wod, setWod] = useState<WodState>(() => ({
    dateISO: date,
    strength: { title: '', description: '', scoreHint: '', recordScore: false },
    title: '',
    description: '',
    scoring: 'for_time',
    timeCap: '',
    recordMainScore: true,
  }));

  // Busy / lock
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // MAIN suggestions
  const mainInputRef = useRef<HTMLInputElement | null>(null);
  const [mainQuery, setMainQuery] = useState('');
  const [mainSugs, setMainSugs] = useState<MainSuggestion[]>([]);
  const [mainOpen, setMainOpen] = useState(false);
  const [mainSearching, setMainSearching] = useState(false);
  const suppressMainOpenRef = useRef(false);

  // STRENGTH suggestions
  const strInputRef = useRef<HTMLInputElement | null>(null);
  const [strQuery, setStrQuery] = useState('');
  const [strSugs, setStrSugs] = useState<StrengthSuggestion[]>([]);
  const [strOpen, setStrOpen] = useState(false);
  const [strSearching, setStrSearching] = useState(false);
  const suppressStrOpenRef = useRef(false);

  // Active rings only when *actively* searching AND there are matches
  const mainActive = mainSearching && wod.title.trim().length > 0 && mainSugs.length > 0;
  const strActive  = strSearching  && wod.strength.title.trim().length > 0 && strSugs.length > 0;

  // Base input classes
  const fieldBase =
    'w-full rounded-md border bg-transparent px-2 py-2 text-sm outline-none ' +
    'border-zinc-800 focus:ring-2 focus:ring-zinc-700/50';

  // Load WOD for a date (expects your API to accept ?date=YYYY-MM-DD and return a WOD or null)
  async function load(dateISO: string) {
    setLoading(true);
    try {
      const j = await getJSON<any>(`/api/wod?date=${dateISO}`);
      if (!j || !j.wod) {
        // blank
        setWod({
          dateISO,
          strength: { title: '', description: '', scoreHint: '', recordScore: false },
          title: '',
          description: '',
          scoring: 'for_time',
          timeCap: '',
          recordMainScore: true,
        });
        setLocked(false);
      } else {
        setWod({
          dateISO,
          strength: {
            title: j.wod.strengthTitle || '',
            description: j.wod.strengthDescription || '',
            scoreHint: j.wod.strengthScoreHint || '',
            recordScore: !!j.wod.strengthRecordScore,
          },
          title: j.wod.title || '',
          description: j.wod.description || '',
          scoring: (j.wod.scoring || 'for_time') as ScoringType,
          timeCap: j.wod.timeCap || '',
          recordMainScore: !!j.wod.recordMainScore,
        });
        setLocked(!!j.locked); // if your API sets locked per role
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to load WOD');
    } finally {
      // Reset *search* state so past navigation never shows green borders
      setMainSearching(false);
      setStrSearching(false);
      setMainSugs([]); setMainOpen(false);
      setStrSugs([]);  setStrOpen(false);
      setLoading(false);
    }
  }

  // Save
  async function save() {
    try {
      setSaving(true);
      await postJSON('/api/wod', {
        date: wod.dateISO,
        title: wod.title || null,
        description: wod.description || null,
        scoring: wod.scoring,
        timeCap: wod.timeCap || null,
        strengthTitle: wod.strength.title || null,
        strengthDescription: wod.strength.description || null,
        strengthScoreHint: wod.strength.scoreHint || null,
        strengthRecordScore: !!wod.strength.recordScore,
        recordMainScore: !!wod.recordMainScore,
      });
      // optional toast…
    } catch (e: any) {
      alert(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // Load on date change
  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Fetch MAIN suggestions (only when actively searching)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!mainSearching || !mainQuery) {
        setMainSugs([]); setMainOpen(false);
        return;
      }
      try {
        // your API: returns array of { title, description?, scoring?, timeCap? }
        const sugs: MainSuggestion[] = await getJSON(`/api/wod?suggest=main&q=${encodeURIComponent(mainQuery)}`);
        if (!alive) return;
        setMainSugs(sugs);
        setMainOpen(sugs.length > 0);

        if (suppressMainOpenRef.current) {
          setMainSugs([]); setMainOpen(false);
          suppressMainOpenRef.current = false;
        }
      } catch {
        if (!alive) return;
        setMainSugs([]); setMainOpen(false);
      }
    })();
    return () => { alive = false; };
  }, [mainQuery, mainSearching]);

  // Fetch STRENGTH suggestions (only when actively searching)
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!strSearching || !strQuery) {
        setStrSugs([]); setStrOpen(false);
        return;
      }
      try {
        // your API: returns array of { strengthTitle, strengthDescription, strengthScoreHint }
        const sugs: StrengthSuggestion[] = await getJSON(`/api/wod?suggest=strength&q=${encodeURIComponent(strQuery)}`);
        if (!alive) return;
        setStrSugs(sugs);
        setStrOpen(sugs.length > 0);

        if (suppressStrOpenRef.current) {
          setStrSugs([]); setStrOpen(false);
          suppressStrOpenRef.current = false;
        }
      } catch {
        if (!alive) return;
        setStrSugs([]); setStrOpen(false);
      }
    })();
    return () => { alive = false; };
  }, [strQuery, strSearching]);

  // Apply a MAIN suggestion
function applyMainSuggestion(s: MainSuggestion) {
  suppressMainOpenRef.current = true;
  setMainSearching(false);
  setWod(prev => ({
    ...prev,
    title: s.title ?? prev.title,
    description: s.description ?? prev.description ?? '',
    scoring: (s.scoring ?? prev.scoring ?? 'for_time') as ScoringType,
    timeCap: s.timeCap ?? prev.timeCap ?? '',
  }));
  setMainOpen(false);
  mainInputRef.current?.blur();
}


  // Apply a STRENGTH suggestion
function applyStrengthSuggestion(s: StrengthSuggestion) {
  suppressStrOpenRef.current = true;
  setStrSearching(false);
  setWod(prev => ({
    ...prev,
    strength: {
      ...prev.strength,
      title: s.strengthTitle ?? prev.strength.title ?? '',
      description: s.strengthDescription ?? prev.strength.description ?? '',
      scoreHint: s.strengthScoreHint ?? prev.strength.scoreHint ?? '',
    },
  }));
  setStrOpen(false);
  strInputRef.current?.blur();
}


  // UI
  return (
    <section className="max-w-3xl mx-auto p-3">
      <header className="flex items-center justify-center mb-3 relative">
        <h1 className="text-xl font-semibold absolute left-0">WOD</h1>
        {/* @ts-ignore */}
        <DateStepper value={date} onChange={(v: string) => setDate(v)} />
      </header>

      {loading ? (
        <div className="text-sm text-zinc-400 py-8">Loading WOD…</div>
      ) : (
        <>
          {/* Strength / Skills */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 mb-4">
            <div className="text-sm font-semibold mb-2">Strength / Skills</div>

            <label className="block text-[12px] text-zinc-400">Title</label>
            <div className="relative">
              <input
                ref={strInputRef}
                disabled={locked}
                value={wod.strength.title}
                onChange={(e) => {
                  setStrSearching(true);
                  setWod(s => ({ ...s, strength: { ...s.strength, title: e.target.value } }));
                  setStrQuery(e.target.value.trim());
                }}
                onFocus={() => { setStrSearching(true); setStrOpen(strSugs.length > 0); }}
                onBlur={() => { setTimeout(() => setStrOpen(false), 120); setStrSearching(false); }}
                placeholder="e.g. Back Squat"
                className={
                  fieldBase +
                  (strActive ? ' border-emerald-500 bg-emerald-900/20 ring-2 ring-emerald-500'
                             : '')
                }
              />
              {strOpen && strSugs.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 shadow-lg">
                  <ul className="max-h-60 overflow-auto text-sm">
                    {strSugs.map((s, i) => (
                      <li
                        key={i}
                        className="p-2 hover:bg-emerald-950/20 cursor-pointer"
                        onMouseDown={(e) => { e.preventDefault(); applyStrengthSuggestion(s); }}
                      >
                        <div className="font-medium">{s.strengthTitle}</div>
                        {s.strengthDescription ? (
                          <div className="text-xs text-zinc-400 line-clamp-2">{s.strengthDescription}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2">
              <label className="block text-[12px] text-zinc-400">Score (hint)</label>
              <input
                disabled={locked}
                value={wod.strength.scoreHint}
                onChange={(e) => setWod(s => ({ ...s, strength: { ...s.strength, scoreHint: e.target.value } }))}
                placeholder="e.g. 3RM, Max Reps, Best unbroken, etc."
                className={fieldBase}
              />

              <label className="block text-[12px] text-zinc-400">Description</label>
              <textarea
                disabled={locked}
                value={wod.strength.description}
                onChange={(e) => setWod(s => ({ ...s, strength: { ...s.strength, description: e.target.value } }))}
                rows={4}
                className={fieldBase}
              />

              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  disabled={locked}
                  checked={wod.strength.recordScore}
                  onChange={(e) => setWod(s => ({ ...s, strength: { ...s.strength, recordScore: e.target.checked } }))}
                />
                <span>Record score for Strength / Skills</span>
              </label>
            </div>
          </div>

          {/* Main WOD */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-sm font-semibold mb-2">Main WOD</div>

            <label className="block text-[12px] text-zinc-400">Title</label>
            <div className="relative">
              <input
                ref={mainInputRef}
                disabled={locked}
                placeholder="e.g. Fran / EMOM 12’ / 5 Rounds …"
                value={wod.title}
                onChange={(e) => {
                  setMainSearching(true);
                  setWod(s => ({ ...s, title: e.target.value }));
                  setMainQuery(e.target.value.trim());
                }}
                onFocus={() => { setMainSearching(true); setMainOpen(mainSugs.length > 0); }}
                onBlur={() => { setTimeout(() => setMainOpen(false), 120); setMainSearching(false); }}
                className={
                  fieldBase +
                  (mainActive ? ' border-emerald-500 bg-emerald-900/20 ring-2 ring-emerald-500'
                              : '')
                }
              />
              {mainOpen && mainSugs.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 shadow-lg">
                  <ul className="max-h-60 overflow-auto text-sm">
                    {mainSugs.map((s, i) => (
                      <li
                        key={i}
                        className="p-2 hover:bg-emerald-950/20 cursor-pointer"
                        onMouseDown={(e) => { e.preventDefault(); applyMainSuggestion(s); }}
                      >
                        <div className="font-medium">{s.title}</div>
                        {s.description ? (
                          <div className="text-xs text-zinc-400 line-clamp-2">{s.description}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2">
              <div>
                <label className="block text-[12px] text-zinc-400 mb-1">Scoring</label>
                <select
                  disabled={locked}
                  value={wod.scoring}
                  onChange={(e) => setWod(s => ({ ...s, scoring: e.target.value as ScoringType }))}
                  className={fieldBase}
                >
                  {scoringOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <label className="block text-[12px] text-zinc-400">Description</label>
              <textarea
                disabled={locked}
                value={wod.description}
                onChange={(e) => setWod(s => ({ ...s, description: e.target.value }))}
                rows={6}
                className={fieldBase}
              />

              <label className="block text-[12px] text-zinc-400">Time cap</label>
              <input
                disabled={locked}
                value={wod.timeCap}
                onChange={(e) => setWod(s => ({ ...s, timeCap: e.target.value }))}
                placeholder="e.g. 16:00"
                className={fieldBase}
              />

              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  disabled={locked}
                  checked={wod.recordMainScore}
                  onChange={(e) => setWod(s => ({ ...s, recordMainScore: e.target.checked }))}
                />
                <span>Record score for Main WOD</span>
              </label>
            </div>
          </div>

          {/* Footer actions */}
          <div className="mt-4 flex justify-end gap-2">
            <button
              disabled={saving || locked}
              onClick={save}
              className="px-3 py-2 rounded-md border border-emerald-700 text-emerald-300 hover:bg-emerald-950/30 text-sm"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
