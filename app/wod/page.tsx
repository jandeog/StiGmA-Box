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

/* ---------------- Auto-resize textarea (no inner scroll) ---------------- */

type AutoResizeTextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string };

function AutoResizeTextarea({ value, onChange, className, ...rest }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // adjust height whenever value changes
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
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-sm font-semibold mb-2">Strength / Skills</div>

      <label className="block text-[12px] text-zinc-400">Title</label>
      <input
        value={wod.strength.title}
        onChange={(e) =>
          setWod((s) => ({
            ...s,
            strength: { ...s.strength, title: e.target.value },
          }))
        }
        placeholder="e.g. Back Squat"
        readOnly={readOnly}
        className={`${fieldBase} ${readOnly ? 'pointer-events-none' : ''}`}
      />

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

        {/* hide checkbox completely in read-only (athlete) mode */}
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
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-sm font-semibold mb-2">Main WOD</div>

      <label className="block text-[12px] text-zinc-400">Title</label>
      <input
        placeholder="e.g. Fran / EMOM 12’ / 5 Rounds …"
        value={wod.title}
        onChange={(e) =>
          setWod((s) => ({
            ...s,
            title: e.target.value,
          }))
        }
        readOnly={readOnly}
        className={`${fieldBase} ${readOnly ? 'pointer-events-none' : ''}`}
      />

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

        {/* hide checkbox completely in read-only (athlete) mode */}
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
};

function AthleteDeck({ wod, setWod }: AthleteDeckProps) {
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

  const go = (dir: -1 | 1) => {
    const node = deckRef.current;
    if (!node) return;
    const w = node.clientWidth || 0;
    node.scrollTo({ left: node.scrollLeft + dir * w, behavior: 'smooth' });
  };

  return (
    <>
      {/* indicators only (no arrows) */}
      <div className="flex items-center justify-center gap-3 mb-3">
  
  {/* Desktop arrows */}
  <button
    onClick={() => go(-1)}
    className="hidden sm:block px-2 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-sm"
  >
    ←
  </button>

  {/* Indicators (mobile + desktop) */}
  <div className="flex gap-1">
    <span
      className={cx(
        'h-1.5 w-6 rounded-full',
        ix === 0 ? 'bg-emerald-500' : 'bg-zinc-700'
      )}
    />
    <span
      className={cx(
        'h-1.5 w-6 rounded-full',
        ix === 1 ? 'bg-emerald-500' : 'bg-zinc-700'
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


      {/* deck */}
      <div
        ref={deckRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        <div className="min-w-full snap-start pr-2">
          <StrengthBlock wod={wod} setWod={setWod} readOnly />
        </div>
        <div className="min-w-full snap-start pl-2">
          <MainWodBlock wod={wod} setWod={setWod} readOnly />
        </div>
      </div>
    </>
  );
}

/* ---------------- Page ---------------- */

export default function WodPage() {
  // ISO date string yyyy-mm-dd
  const [date, setDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [isCoach, setIsCoach] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  // ---- ROLE + WOD FETCH (per date) ----
  useEffect(() => {
    let alive = true;

    async function loadAll() {
      try {
        // role
        const r = await fetch('/api/me', { cache: 'no-store' });
        const j = r.ok ? await r.json() : {};
        if (!alive) return;
        setIsCoach(!!j?.me?.is_coach);
      } catch {
        if (!alive) return;
        setIsCoach(false);
      }

      const reset = () =>
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

      // wod per date
      try {
        const wr = await fetch(`/api/wod?date=${encodeURIComponent(date)}`, {
          cache: 'no-store',
        });
        if (wr.ok) {
          const wj = await wr.json();
          const row = wj?.wod || null;
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
          } else if (alive) {
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
    } catch (err: any) {
      alert(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header row */}
      <div className="flex flex-col items-center gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-center sm:text-left">WOD</h1>

        {/* DateStepper */}
        <div className="flex items-center gap-2 justify-center w-full sm:w-auto sm:justify-end">
          <DateStepper
            {...({ value: date, onChange: (d: string) => setDate(d) } as any)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400 py-8">Loading WOD…</div>
      ) : (
        <>
          {isCoach ? (
            // === COACH: vertical editor ===
            <div className="grid gap-4">
              <StrengthBlock wod={wod} setWod={setWod} />
              <MainWodBlock wod={wod} setWod={setWod} />
            </div>
          ) : (
            // === ATHLETE: horizontal deck ===
            <AthleteDeck wod={wod} setWod={setWod} />
          )}

          {/* Footer actions (coach only) */}
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
