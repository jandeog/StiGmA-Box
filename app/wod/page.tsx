'use client';

import { useEffect, useRef, useState } from 'react';
import DateStepper from '@/components/DateStepper';

type ScoringType = 'for_time' | 'amrap' | 'emom' | 'max_load' | 'max_reps' | 'other';

const scoringOptions: Array<{ value: ScoringType; label: string }> = [
  { value: 'for_time', label: 'For time' },
  { value: 'amrap', label: 'AMRAP' },
  { value: 'emom', label: 'EMOM' },
  { value: 'max_load', label: 'Max load' },
  { value: 'max_reps', label: 'Max reps' },
  { value: 'other', label: 'Other' },
];


const fieldBase =
  'w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-600';

function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(' ');
}

type WodState = {
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string;
  recordMainScore: boolean;
  strength: {
    title: string;
    description: string;
    scoreHint: string;
    recordScore: boolean;
  };
};

type SetWod = (updater: (prev: WodState) => WodState) => void;

type MainSuggestion = {
  title: string | null;
  description: string | null;
  scoring: string | null;
  timeCap: string | null;
};

type StrengthSuggestion = {
  strengthTitle: string | null;
  strengthDescription: string | null;
  strengthScoreHint: string | null;
};

/* ---------------- Auto-resize textarea (no inner scroll) ---------------- */

type AutoResizeTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string };

function AutoResizeTextarea({ value, onChange, className, ...rest }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
    onChange?.(e);
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={handleChange}
      rows={1}
      className={`${fieldBase} resize-none overflow-hidden ${className ?? ''}`}
      {...rest}
    />
  );
}

/* ---------------- Shared Blocks ---------------- */

type StrengthBlockProps = {
  wod: WodState;
  setWod: SetWod;
  readOnly?: boolean;
};

function StrengthBlock({ wod, setWod, readOnly = false }: StrengthBlockProps) {
  // suggestions for Strength / Skills title
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<StrengthSuggestion[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      setShowMenu(false);
      return;
    }

    let alive = true;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/wod?suggest=strength&q=${encodeURIComponent(searchTerm)}`,
          { cache: 'no-store' },
        );
        if (!res.ok || !alive) return;
        const data = (await res.json()) as StrengthSuggestion[];
        setSuggestions((data ?? []).slice(0, 3));
        setShowMenu((data ?? []).length > 0);
      } catch {
        if (!alive) return;
        setSuggestions([]);
        setShowMenu(false);
      }
    }, 200);

    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [searchTerm]);

  const applySuggestion = (s: StrengthSuggestion) => {
    setWod((prev) => ({
      ...prev,
      strength: {
        ...prev.strength,
        title: s.strengthTitle ?? '',
        description: s.strengthDescription ?? '',
        scoreHint: s.strengthScoreHint ?? '',
      },
    }));
    setShowMenu(false);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-sm font-semibold mb-2">Strength / Skills</div>

      <label className="block text-[12px] text-zinc-400">Title</label>
      <input
        value={wod.strength.title}
        onChange={(e) => {
          const val = e.target.value;
          setWod((s) => ({
            ...s,
            strength: { ...s.strength, title: val },
          }));
          if (!readOnly) {
            setSearchTerm(val);
          }
        }}
        placeholder="e.g. Back Squat"
        readOnly={readOnly}
        className={`${fieldBase} ${readOnly ? 'pointer-events-none' : ''}`}
      />

      {/* suggestions dropdown for strength title */}
      {!readOnly && showMenu && suggestions.length > 0 && (
        <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 text-xs overflow-hidden">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applySuggestion(s)}
              className="block w-full text-left px-2 py-1 hover:bg-zinc-800"
            >
              <div className="font-medium">
                {s.strengthTitle || '(no title)'}
              </div>
              {s.strengthDescription && (
                <div className="text-[11px] text-zinc-400 truncate">
                  {s.strengthDescription}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2">
        <label className="block text-[12px] text-zinc-400">Score (hint)</label>
        <input
          value={wod.strength.scoreHint}
          onChange={(e) =>
            setWod((s) => ({
              ...s,
              strength: { ...s.strength, scoreHint: e.target.value },
            }))
          }
          placeholder="e.g. 3RM, Max Reps…"
          readOnly={readOnly}
          className={`${fieldBase} ${readOnly ? 'pointer-events-none' : ''}`}
        />

        <label className="block text-[12px] text-zinc-400">Description</label>
        <AutoResizeTextarea
          value={wod.strength.description}
          onChange={(e) =>
            setWod((s) => ({
              ...s,
              strength: { ...s.strength, description: e.target.value },
            }))
          }
          placeholder=""
          readOnly={readOnly}
          className={readOnly ? 'pointer-events-none' : ''}
        />

        {!readOnly && (
          <label className="mt-2 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-500"
              checked={wod.strength.recordScore}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: {
                    ...s.strength,
                    recordScore: e.target.checked,
                  },
                }))
              }
            />
            <span>Record score for Strength / Skills</span>
          </label>
        )}
      </div>
    </div>
  );
}

type MainWodBlockProps = {
  wod: WodState;
  setWod: SetWod;
  readOnly?: boolean;
};

function MainWodBlock({ wod, setWod, readOnly = false }: MainWodBlockProps) {
  // suggestions for Main WOD title
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<MainSuggestion[]>([]);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([]);
      setShowMenu(false);
      return;
    }

    let alive = true;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/wod?suggest=main&q=${encodeURIComponent(searchTerm)}`,
          { cache: 'no-store' },
        );
        if (!res.ok || !alive) return;
        const data = (await res.json()) as MainSuggestion[];
        setSuggestions((data ?? []).slice(0, 3));
        setShowMenu((data ?? []).length > 0);
      } catch {
        if (!alive) return;
        setSuggestions([]);
        setShowMenu(false);
      }
    }, 200);

    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [searchTerm]);

  const applySuggestion = (s: MainSuggestion) => {
    setWod((prev) => ({
      ...prev,
      title: s.title ?? '',
      description: s.description ?? '',
      scoring: (s.scoring as ScoringType) ?? prev.scoring,
      timeCap: s.timeCap ?? prev.timeCap,
    }));
    setShowMenu(false);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-sm font-semibold mb-2">Main WOD</div>

      <label className="block text-[12px] text-zinc-400">Title</label>
      <input
        placeholder="e.g. Fran / EMOM 12’ / 5 Rounds …"
        value={wod.title}
        onChange={(e) => {
          const val = e.target.value;
          setWod((s) => ({
            ...s,
            title: val,
          }));
          if (!readOnly) {
            setSearchTerm(val);
          }
        }}
        readOnly={readOnly}
        className={`${fieldBase} ${readOnly ? 'pointer-events-none' : ''}`}
      />

      {/* suggestions dropdown for main WOD title */}
      {!readOnly && showMenu && suggestions.length > 0 && (
        <div className="mt-1 rounded-md border border-zinc-700 bg-zinc-900 text-xs overflow-hidden">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applySuggestion(s)}
              className="block w-full text-left px-2 py-1 hover:bg-zinc-800"
            >
              <div className="font-medium">
                {s.title || '(no title)'}
              </div>
              {s.description && (
                <div className="text-[11px] text-zinc-400 truncate">
                  {s.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 grid gap-2">
        <div>
          <label className="block text-[12px] text-zinc-400 mb-1">Scoring</label>
          <select
            value={wod.scoring}
            onChange={(e) =>
              setWod((s) => ({
                ...s,
                scoring: e.target.value as ScoringType,
              }))
            }
            disabled={readOnly}
            className={`${fieldBase} ${readOnly ? 'pointer-events-none' : ''}`}
          >
            {scoringOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <label className="block text-[12px] text-zinc-400">Description</label>
        <AutoResizeTextarea
          value={wod.description}
          onChange={(e) =>
            setWod((s) => ({
              ...s,
              description: e.target.value,
            }))
          }
          placeholder=""
          readOnly={readOnly}
          className={readOnly ? 'pointer-events-none' : ''}
        />

        <label className="block text-[12px] text-zinc-400">Time cap</label>
        <input
          value={wod.timeCap}
          onChange={(e) =>
            setWod((s) => ({
              ...s,
              timeCap: e.target.value,
            }))
          }
          placeholder="e.g. 16:00"
          readOnly={readOnly}
          className={`${fieldBase} ${readOnly ? 'pointer-events-none' : ''}`}
        />

        {!readOnly && (
          <label className="mt-2 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-emerald-500"
              checked={wod.recordMainScore}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  recordMainScore: e.target.checked,
                }))
              }
            />
            <span>Record score for Main WOD</span>
          </label>
        )}
      </div>
    </div>
  );
}

/* ---------------- Athlete Slide Deck ---------------- */

type AthleteDeckProps = {
  wod: WodState;
  setWod: SetWod;
  locked: boolean;
};

function AthleteDeck({ wod, setWod, locked }: AthleteDeckProps) {
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [ix, setIx] = useState(0);

  useEffect(() => {
    const node = deckRef.current;
    if (!node) return;

    const onScroll = () => {
      const w = node.clientWidth || 1;
      const newIx = Math.round(node.scrollLeft / w);
      setIx(newIx);
    };

    node.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      node.removeEventListener('scroll', onScroll);
    };
  }, []);

  // 🔒 RULE A – visibility / booking rule
  if (locked) {
    return (
      <div className="text-center text-zinc-400 py-10 text-sm">
        You can view today&apos;s WOD only after the class you booked has finished.
        <br />
        If you did not book a class today, you will be able to see it after the day has passed.
        <br />
        Please attend a class or come back tomorrow.
      </div>
    );
  }

  // Check if coach actually programmed those parts
  const isStrengthEmpty =
    !wod.strength.title &&
    !wod.strength.description &&
    !wod.strength.scoreHint;

  const isMainEmpty =
    !wod.title &&
    !wod.description &&
    !wod.timeCap;

  const go = (dir: -1 | 1) => {
    const node = deckRef.current;
    if (!node) return;
    const w = node.clientWidth || 0;
    node.scrollTo({ left: node.scrollLeft + dir * w, behavior: 'smooth' });
  };

  return (
    <>
      <div className="flex items-center justify-center gap-3 mb-3">
        {/* Desktop arrows */}
        <button
          onClick={() => go(-1)}
          className="hidden sm:block px-2 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-sm"
        >
          ←
        </button>

        {/* Indicators */}
        <div className="flex gap-1">
          <span
            className={cx(
              'h-1.5 w-6 rounded-full',
              ix === 0 ? 'bg-emerald-500' : 'bg-zinc-700',
            )}
          />
          <span
            className={cx(
              'h-1.5 w-6 rounded-full',
              ix === 1 ? 'bg-emerald-500' : 'bg-zinc-700',
            )}
          />
        </div>

        {/* Desktop arrows */}
        <button
          onClick={() => go(1)}
          className="hidden sm:block px-2 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-sm"
        >
          →
        </button>
      </div>

      <div
        ref={deckRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        <div className="min-w-full snap-start pr-2">
          {isStrengthEmpty ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center text-sm text-zinc-400">
              No strength / skills part for today.
            </div>
          ) : (
            <StrengthBlock wod={wod} setWod={setWod} readOnly />
          )}
        </div>

        <div className="min-w-full snap-start pl-2">
          {isMainEmpty ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center text-sm text-zinc-400">
              No main WOD part for today.
            </div>
          ) : (
            <MainWodBlock wod={wod} setWod={setWod} readOnly />
          )}
        </div>
      </div>


    </>
  );
}

/* ---------------- Page ---------------- */

export default function WodPage() {
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [isCoach, setIsCoach] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [wodDates, setWodDates] = useState<string[]>([]);

  const [wod, setWod] = useState<WodState>(() => ({
    title: '',
    description: '',
    scoring: 'for_time',
    timeCap: '',
    recordMainScore: true,
    strength: {
      title: '',
      description: '',
      scoreHint: '',
      recordScore: false,
    },
  }));

    const [locked, setLocked] = useState(false);

  // ---- Load ALL WOD dates once (for calendar coloring) ----
  useEffect(() => {
    let alive = true;

    async function loadAllWodDates() {
      try {
        const res = await fetch('/api/wod/dates', { cache: 'no-store' });
        if (!res.ok) return;

        const json = await res.json();
        const dates = (json?.dates ?? []) as string[];

        if (!alive) return;

        setWodDates(Array.from(new Set(dates)));
      } catch (err) {
        console.error('Failed to load WOD dates', err);
      }
    }

    loadAllWodDates();
    return () => {
      alive = false;
    };
  }, []);

  // ---- ROLE + WOD FETCH (per date) ----
  useEffect(() => {
    let alive = true;

    async function loadAll() {
      try {
        const r = await fetch('/api/me', { cache: 'no-store' });
        const j = r.ok ? await r.json() : {};
        if (!alive) return;
        setIsCoach(!!j?.me?.is_coach);
      } catch {
        if (!alive) return;
        setIsCoach(false);
      }

      const reset = () => {
        setWod(() => ({
          title: '',
          description: '',
          scoring: 'for_time',
          timeCap: '',
          recordMainScore: true,
          strength: {
            title: '',
            description: '',
            scoreHint: '',
            recordScore: false,
          },
        }));
                setLocked(false);
        setWodDates((prev) => prev.filter((d) => d !== date));
      };

      try {
        const wr = await fetch(`/api/wod?date=${encodeURIComponent(date)}`, {
          cache: 'no-store',
        });
        if (wr.ok) {
          const wj = await wr.json();
          const row = wj?.wod || null;
          const lockedFromApi = !!wj?.locked;

          if (alive) {
            // Just mirror the API
            setLocked(lockedFromApi);
          }

          if (alive && row) {
            setWod(() => ({
              title: row.title || '',
              description: row.description || '',
              scoring: (row.scoring as ScoringType) || 'for_time',
              timeCap: row.timeCap || row.time_cap || '',
              recordMainScore: row.recordMainScore ?? !!row.record_main_score,
              strength: {
                title: row.strengthTitle || row.strength_title || '',
                description:
                  row.strengthDescription || row.strength_description || '',
                scoreHint:
                  row.strengthScoreHint || row.strength_score_hint || '',
                recordScore:
                  row.strengthRecordScore ?? !!row.strength_record_score,
              },
            }));

            setWodDates((prev) =>
              prev.includes(date) ? prev : [...prev, date],
            );
          } else if (alive && !lockedFromApi) {
            // only reset when it's NOT locked (i.e. simply "no WOD programmed")
            reset();
          }
        } else if (alive) {
          reset();
        }


      } catch {
        if (alive) reset();
      } finally {
        if (alive) setLoading(false);
      }
    }

    setLoading(true);
    loadAll();
    return () => {
      alive = false;
    };
  }, [date]);

  // ---- SAVE (upsert) ----
  async function onSaveCoach() {
    setSaving(true);
    try {
      const payload = {
        date,
        title: wod.title,
        description: wod.description,
        scoring: wod.scoring,
        timeCap: wod.timeCap,
        recordMainScore: wod.recordMainScore,
        strengthTitle: wod.strength.title,
        strengthDescription: wod.strength.description,
        strengthScoreHint: wod.strength.scoreHint,
        strengthRecordScore: wod.strength.recordScore,
      };

      const r = await fetch('/api/wod', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `Save failed (HTTP ${r.status})`);
      }

      setWodDates((prev) =>
        prev.includes(date) ? prev : [...prev, date],
      );
    } catch (err: any) {
      alert(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col items-center gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-center sm:text-left">WOD</h1>

        <div className="flex items-center gap-2 justify-center w-full sm:w-auto sm:justify-end">
          <DateStepper
            value={date}
            onChange={(d: string) => setDate(d)}
            highlightedDates={wodDates}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400 py-8">Loading WOD…</div>
      ) : (
        <>
          {new Date(date).getDay() === 0 ? (
            <div className="text-center text-zinc-400 py-10 text-lg">
              Rest Day – No WOD for today
            </div>
          ) : isCoach ? (
            <div className="grid gap-4">
              <StrengthBlock wod={wod} setWod={setWod} />
              <MainWodBlock wod={wod} setWod={setWod} />
            </div>
          ) : (
            <AthleteDeck wod={wod} setWod={setWod} locked={locked} />
          )}
          {isCoach && (
            <div className="mt-4 flex justify-end gap-2">
              <button
                disabled={saving}
                onClick={onSaveCoach}
                className="px-3 py-2 rounded-md border border-emerald-700 text-emerald-300 hover:bg-emerald-950/30 text-sm"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* Optional: add to globals.css for cleaner deck
.no-scrollbar::-webkit-scrollbar { display:none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
*/
