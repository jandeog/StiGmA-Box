// app/wod/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DateStepper from '@/components/DateStepper';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { ReactElement } from 'react';

type ScoringType = 'for_time' | 'amrap' | 'emom';

type StrengthPart = {
  title: string;
  description: string;
  scoreHint: string;
  recordScore: boolean;
};

type WOD = {
  strength: StrengthPart;
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string;
  recordMainScore: boolean;
};

// ===== Helpers =====
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

// 00:00:00 Europe/Athens → ISO (πρακτικά επαρκές)
const toAthensMidnightISO = (yyyy_mm_dd: string) =>
  new Date(`${yyyy_mm_dd}T00:00:00+03:00`).toISOString();

const defaultWOD = (): WOD => ({
  strength: { title: '', description: '', scoreHint: '', recordScore: false },
  title: '',
  description: '',
  scoring: 'for_time',
  timeCap: '',
  recordMainScore: true,
});

// Για τα suggestions του Main WOD
type MainSuggestion = {
  title: string;
  description: string | null;
  scoring: ScoringType | null;
  timeCap: string | null;
};

// Για τα suggestions του Strength/Skills
type StrengthSuggestion = {
  strengthTitle: string | null;
  strengthDescription: string | null;
  strengthScoreHint: string | null;
};

export default function WodPage() {
  const supabase = createClientComponentClient();
  const [date, setDate] = useState(todayStr());
  const [wod, setWod] = useState<WOD>(defaultWOD());
  const [savedMsg, setSavedMsg] = useState('');
  const [locked, setLocked] = useState(false);

  // Autocomplete state (Main)
  const [mainSugs, setMainSugs] = useState<MainSuggestion[]>([]);
  const [mainOpen, setMainOpen] = useState(false);
  const mainInputRef = useRef<HTMLInputElement | null>(null);

  // Autocomplete state (Strength)
  const [strSugs, setStrSugs] = useState<StrengthSuggestion[]>([]);
  const [strOpen, setStrOpen] = useState(false);
  const strInputRef = useRef<HTMLInputElement | null>(null);

  // Κοινή κλάση για inputs
  const fieldBase =
    'w-full rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm field-muted ' +
    'focus:outline-none shadow-sm transition';

  // ===== Load από Supabase όταν αλλάζει η μέρα =====
  useEffect(() => {
    let isMounted = true;

    (async () => {
      setSavedMsg('');
      setLocked(false);

      const atMidnight = toAthensMidnightISO(date);

      const { data, error } = await supabase
        .from('Wod')
        .select(
          'title, description, scoring, timeCap, strengthTitle, strengthDescription, strengthScoreHint, strengthRecordScore, recordMainScore'
        )
        .eq('date', atMidnight)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error('[WOD load error]', error);
        setWod(defaultWOD());
        return;
      }

      if (data) {
        setWod({
          strength: {
            title: data.strengthTitle ?? '',
            description: data.strengthDescription ?? '',
            scoreHint: data.strengthScoreHint ?? '',
            recordScore: !!data.strengthRecordScore,
          },
          title: data.title ?? '',
          description: data.description ?? '',
          scoring: (data.scoring as ScoringType) ?? 'for_time',
          timeCap: data.timeCap ?? '',
          recordMainScore: data.recordMainScore ?? true,
        });
      } else {
        setWod(defaultWOD());
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [date, supabase]);

  // ===== Save/Upsert στο Supabase =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wod.title.trim()) {
      setSavedMsg('⚠️ Πρόσθεσε τίτλο για το Main WOD');
      return;
    }

    // Auth guard
    const {
      data: { user },
      error: uerr,
    } = await supabase.auth.getUser();
    if (!user) {
      setSavedMsg('⚠️ Πρέπει να είσαι συνδεδεμένος για να κάνεις Save.');
      console.log('[AUTH USER] NULL', uerr ?? null);
      return;
    }

    const atMidnight = toAthensMidnightISO(date);

    const row = {
      date: atMidnight,
      title: wod.title,
      description: wod.description,
      scoring: wod.scoring,
      timeCap: wod.timeCap || null,
      strengthTitle: wod.strength.title || null,
      strengthDescription: wod.strength.description || null,
      strengthScoreHint: wod.strength.scoreHint || null,
      strengthRecordScore: wod.strength.recordScore,
      recordMainScore: wod.recordMainScore,
    };

    const { error } = await supabase.from('Wod').upsert(row, {
      onConflict: 'date',
    });

    if (error) {
      console.error('[WOD save error]', error);
      setSavedMsg(
        `❌ Save failed: ${error.message}${
          (error as any).details ? ' — ' + (error as any).details : ''
        }`
      );
      return;
    }

    setSavedMsg('✅ Αποθηκεύτηκε στη βάση για αυτή την ημερομηνία');
    setTimeout(() => setSavedMsg(''), 1600);
  };

  // ============ AUTOCOMPLETE LOGIC ============
  // Debounce helper
  const useDebounced = (value: string, delay = 180) => {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
      const id = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
  };

  // --- MAIN WOD suggestions (ψάχνει σε ΟΛΑ τα WODs, όχι μόνο benchmarks)
  const fetchMainSuggestions = async (q: string) => {
    const qTrim = q.trim();
    if (!qTrim) return [];
    const { data, error } = await supabase
      .from('Wod')
      .select('title, description, scoring, timeCap')
      .not('title', 'is', null)
      .ilike('title', `%${qTrim}%`) // prefix match
      .order('title', { ascending: true })
      .limit(20); // φέρνουμε λίγα και θα τα dedupe-άρουμε client-side

    if (error) {
      console.warn('[autocomplete main error]', error);
      return [];
    }

    // dedupe by lower(title)
    const seen = new Set<string>();
    const unique: MainSuggestion[] = [];
    for (const r of data ?? []) {
      const key = r.title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r as MainSuggestion);
      }
      if (unique.length >= 3) break;
    }
    return unique;
  };

  const mainQuery = useDebounced(wod.title, 180);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!mainQuery) {
        setMainSugs([]);
        setMainOpen(false);
        return;
      }
      const sugs = await fetchMainSuggestions(mainQuery);
      if (!alive) return;
      setMainSugs(sugs);
      setMainOpen(sugs.length > 0);
    })();
    return () => {
      alive = false;
    };
  }, [mainQuery]); // eslint-disable-line

const hasMainMatch = useMemo(() => {
  return wod.title.trim().length > 0 && mainSugs.length > 0;
}, [wod.title, mainSugs]);

  const applyMainSuggestion = (s: MainSuggestion) => {
    setWod((prev) => ({
      ...prev,
      title: s.title,
      description: s.description ?? prev.description,
      timeCap: s.timeCap ?? prev.timeCap,
      scoring: (s.scoring ?? prev.scoring) as ScoringType,
    }));
    setMainOpen(false);
    mainInputRef.current?.blur();
  };

  const onMainKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && mainSugs.length > 0) {
      e.preventDefault();
      applyMainSuggestion(mainSugs[0]);
    }
  };

  // --- STRENGTH/SKILLS suggestions (ψάχνει σε ΟΛΑ τα αποθηκευμένα strengthTitle)
  const fetchStrengthSuggestions = async (q: string) => {
    const qTrim = q.trim();
    if (!qTrim) return [];
    const { data, error } = await supabase
      .from('Wod')
      .select('strengthTitle, strengthDescription, strengthScoreHint')
      .not('strengthTitle', 'is', null)
      .ilike('strengthTitle', `%${qTrim}%`) // prefix match
      .order('strengthTitle', { ascending: true })
      .limit(50); // θα κάνουμε dedupe client-side

    if (error) {
      console.warn('[autocomplete strength error]', error);
      return [];
    }

    // dedupe by lower(strengthTitle)
    const seen = new Set<string>();
    const unique: StrengthSuggestion[] = [];
    for (const r of (data ?? []) as StrengthSuggestion[]) {
      const t = r.strengthTitle ?? '';
      const key = t.toLowerCase();
      if (!t || seen.has(key)) continue;
      seen.add(key);
      unique.push(r);
      if (unique.length >= 3) break;
    }
    return unique;
  };

  const strQuery = useDebounced(wod.strength.title, 180);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!strQuery) {
        setStrSugs([]);
        setStrOpen(false);
        return;
      }
      const sugs = await fetchStrengthSuggestions(strQuery);
      if (!alive) return;
      setStrSugs(sugs);
      setStrOpen(sugs.length > 0);
    })();
    return () => {
      alive = false;
    };
  }, [strQuery]); // eslint-disable-line

const hasStrMatch = useMemo(() => {
  return wod.strength.title.trim().length > 0 && strSugs.length > 0;
}, [wod.strength.title, strSugs]);

  const applyStrengthSuggestion = (s: StrengthSuggestion) => {
    setWod((prev) => ({
      ...prev,
      strength: {
        ...prev.strength,
        title: s.strengthTitle ?? prev.strength.title,
        description: s.strengthDescription ?? prev.strength.description,
        scoreHint: s.strengthScoreHint ?? prev.strength.scoreHint,
      },
    }));
    setStrOpen(false);
    strInputRef.current?.blur();
  };

  const onStrKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' && strSugs.length > 0) {
      e.preventDefault();
      applyStrengthSuggestion(strSugs[0]);
    }
  };

  // Common dropdown UI
  const Dropdown = <T extends {}>({
    open,
    items,
    render,
  }: {
    open: boolean;
    items: T[];
    render: (item: T) => ReactElement;
  }) => {
    if (!open || items.length === 0) return null;
    return (
      <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900/95 shadow-lg backdrop-blur">
        <ul className="max-h-56 overflow-auto text-sm">{items.map(render)}</ul>
      </div>
    );
  };

  return (
    <section className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">WOD</h1>

      {/* Date */}
      <div className="flex items-center gap-3">
        <div className="text-sm text-zinc-400">Date</div>
        <DateStepper value={date} onChange={setDate} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Strength / Skills */}
        <h2 className="text-lg font-semibold">Strength / Skills</h2>
        <div className="border border-zinc-800 rounded p-3 bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-sm mb-1 text-zinc-300">Title</label>
              <input
                ref={strInputRef}
                disabled={locked}
                value={wod.strength.title}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    strength: { ...s.strength, title: e.target.value },
                  }))
                }
                onKeyDown={onStrKeyDown}
                placeholder="e.g. Back Squat"
                className={
                  fieldBase +
                  (hasStrMatch
  ? ' border-emerald-500/60 bg-emerald-800/20'
  : ' focus:ring-2 focus:ring-zinc-700/50')
                }
                onFocus={() => setStrOpen(strSugs.length > 0)}
                onBlur={() => setTimeout(() => setStrOpen(false), 120)}
              />
              <Dropdown
                open={strOpen}
                items={strSugs}
                render={(it) => (
                  <li
                    key={it.strengthTitle ?? Math.random().toString(36)}
                    className="px-3 py-2 hover:bg-zinc-800 cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyStrengthSuggestion(it);
                    }}
                  >
                    <div className="font-medium">{it.strengthTitle}</div>
                    {it.strengthDescription ? (
                      <div className="text-zinc-400 line-clamp-1">{it.strengthDescription}</div>
                    ) : null}
                  </li>
                )}
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
                className={fieldBase + ' focus:ring-2 focus:ring-zinc-700/50'}
              />
            </div>
          </div>

          <div className="mt-3">
            <label className="block text-sm mb-1 text-zinc-300">Description</label>
            <textarea
              disabled={locked}
              rows={5}
              value={wod.strength.description}
              onChange={(e) =>
                setWod((s) => ({
                  ...s,
                  strength: { ...s.strength, description: e.target.value },
                }))
              }
              placeholder="Sets, reps, tempo, rest, cues…"
              className={fieldBase + ' focus:ring-2 focus:ring-zinc-700/50'}
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
          {/* Title + Scoring */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="block text-sm mb-1 text-zinc-300">Title</label>
              <input
                ref={mainInputRef}
                disabled={locked}
                placeholder="e.g. Fran / EMOM 12’ / 5 Rounds …"
                value={wod.title}
                onChange={(e) => setWod((s) => ({ ...s, title: e.target.value }))}
                onKeyDown={onMainKeyDown}
                className={
                  fieldBase +
                  (hasMainMatch
  ? ' border-emerald-500/60 bg-emerald-800/20'
  : ' focus:ring-2 focus:ring-zinc-700/50')
                }
                onFocus={() => setMainOpen(mainSugs.length > 0)}
                onBlur={() => setTimeout(() => setMainOpen(false), 120)}
              />
              <Dropdown
                open={mainOpen}
                items={mainSugs}
                render={(it) => (
                  <li
                    key={it.title}
                    className="px-3 py-2 hover:bg-zinc-800 cursor-pointer"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      applyMainSuggestion(it);
                    }}
                  >
                    <div className="font-medium">{it.title}</div>
                    {it.description ? (
                      <div className="text-zinc-400 line-clamp-1">{it.description}</div>
                    ) : null}
                  </li>
                )}
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-zinc-300">Scoring</label>
              <select
                disabled={locked}
                value={wod.scoring}
                onChange={(e) =>
                  setWod((s) => ({
                    ...s,
                    scoring: e.target.value as ScoringType,
                  }))
                }
                className={fieldBase + ' focus:ring-2 focus:ring-zinc-700/50'}
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
              placeholder={`e.g.
21-15-9 Thrusters (42.5/30) & Pull-ups
Time cap: 8:00`}
              value={wod.description}
              onChange={(e) => setWod((s) => ({ ...s, description: e.target.value }))}
              className={fieldBase + ' focus:ring-2 focus:ring-zinc-700/50'}
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
              className={fieldBase + ' focus:ring-2 focus:ring-zinc-700/50'}
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

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className={`px-4 py-2 rounded border border-zinc-700 text-sm ${
              locked ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-800'
            }`}
            disabled={locked}
            title={locked ? 'This date already has a saved WOD (locked)' : 'Save WOD for this date'}
          >
            Save
          </button>
          {savedMsg && <span className="text-sm text-zinc-300">{savedMsg}</span>}
        </div>
      </form>

      {/* Preview */}
      <hr className="my-6 border-zinc-800" />
      <h2 className="text-lg font-semibold mb-2">Preview</h2>
      <div className="border border-zinc-800 rounded p-3 bg-zinc-900 space-y-4">
        <div className="text-sm text-zinc-400">{fmtDDMMYYYY(date)}</div>

        {/* Strength / Skills preview */}
        <div>
          <div className="text-sm text-zinc-400">Strength / Skills</div>
          <div className="font-semibold">{wod.strength.title || '—'}</div>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap">
            {wod.strength.description || '—'}
          </div>
          <div className="text-sm text-zinc-400 mt-1">
            {wod.strength.scoreHint ? `Score: ${wod.strength.scoreHint} • ` : ''}
            Record score: {wod.strength.recordScore ? 'Yes' : 'No'}
          </div>
        </div>

        {/* Main WOD preview */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="text-sm text-zinc-400">Main WOD</div>
          <div className="text-xl font-bold">{wod.title || '—'}</div>
          <div className="text-sm text-zinc-300 whitespace-pre-wrap mt-1">
            {wod.description || '—'}
          </div>
          <div className="text-sm text-zinc-400 mt-1">
            Scoring: {wod.scoring.toUpperCase()}
            {wod.timeCap ? ` • Time cap: ${wod.timeCap}` : ''} • Record score:{' '}
            {wod.recordMainScore ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
    </section>
  );
}
