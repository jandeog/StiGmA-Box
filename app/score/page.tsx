// app/score/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import DateStepper from '@/components/DateStepper';

// ---------- Types ----------

type Role = 'coach' | 'athlete';

type AthleteRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname?: string | null;
  team_name?: string | null;
  email: string;
  phone?: string | null;
  dob?: string | null;
};

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  teamName?: string;
  email: string;
  phone: string;
  dob: string;
};

type ScoringType = 'for_time' | 'amrap' | 'emom' | 'max_load' | 'other';

type StrengthPart = {
  title: string;
  description: string;
  scoreHint: string;
  recordScore?: boolean;
};

type WOD = {
  date: string; // ISO YYYY-MM-DD
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string;
  strength?: StrengthPart;
  recordMainScore?: boolean;
};

type WodApi = {
  wod: {
    date: string;
    title?: string | null;
    description?: string | null;
    scoring?: ScoringType | null;
    timeCap?: string | null;
    strengthTitle?: string | null;
    strengthDescription?: string | null;
    strengthScoreHint?: string | null;
    strengthRecordScore?: boolean | null;
    recordMainScore?: boolean | null;
  } | null;
  locked?: boolean;
};

type StrengthScoreKind = 'weight' | 'reps' | 'time' | 'other';

type Score = {
  id: string;
  athlete: string;
  team?: string;
  rxScaled: 'RX' | 'Scaled';
  value: string;
  date: string;
  part: 'main' | 'strength';
};

type ApiScoreRow = {
  id: string;
  wod_date: string;
  part: 'main' | 'strength';
  rx_scaled: 'RX' | 'Scaled';
  score: string;
  athlete?: {
    first_name?: string | null;
    last_name?: string | null;
    nickname?: string | null;
    team_name?: string | null;
  } | null;
};

// ---------- Helpers ----------

function inferStrengthScoreKind(str?: StrengthPart): StrengthScoreKind {
  if (!str) return 'other';
  const blob = `${str.title} ${str.description} ${str.scoreHint}`.toLowerCase();

  // Typical CF strength cues → weight (kg)
  if (
    /rm\b|1rm|2rm|3rm|5rm|heavy|max load|load|kg|barbell|snatch|clean|jerk|deadlift|back squat|front squat|press|ohs/.test(
      blob,
    )
  ) {
    return 'weight';
  }

  // Max reps / bodyweight tests → reps
  if (
    /max reps|reps|pull[- ]?ups|push[- ]?ups|burpees|wall balls|double unders|sit[- ]?ups|row|calories/.test(
      blob,
    )
  ) {
    return 'reps';
  }

  // Strength “for time” intervals
  if (
    /for time|time cap|min|sec|second|minute|tempo|emom|on the minute/.test(
      blob,
    )
  ) {
    return 'time';
  }

  return 'other';
}

function getMainScoreMeta(wod: WOD | null): {
  label: string;
  placeholder: string;
  help: string;
} {
  if (!wod) {
    return {
      label: 'Score (Main WOD)',
      placeholder: 'Enter score',
      help: '',
    };
  }

  switch (wod.scoring) {
    case 'for_time':
      return {
        label: 'Time (FOR TIME)',
        placeholder: 'mm:ss (if capped: rounds+reps, e.g. 7+15)',
        help:
          'If you finish under the cap, record your time (mm:ss). If you are time-capped, record rounds+reps.',
      };
    case 'amrap':
      return {
        label: 'Reps / Rounds+Reps (AMRAP)',
        placeholder: 'rounds+reps (e.g. 7+12)',
        help: 'Record total completed rounds and extra reps, e.g. 7+12.',
      };
    case 'emom':
      return {
        label: 'Reps per minute / total reps (EMOM)',
        placeholder: 'total reps or best unbroken set (e.g. 85)',
        help:
          'Common options: total reps across all minutes, or best unbroken set. Pick one method and keep it consistent.',
      };
    case 'max_load':
      return {
        label: 'Load (MAX LOAD)',
        placeholder: 'heaviest successful lift in kg (e.g. 120)',
        help: 'Record your heaviest successful lift in kilograms.',
      };
    case 'other':
    default:
      return {
        label: 'Score (Main WOD)',
        placeholder: 'Enter score (time, reps or load)',
        help: 'Use the score format described in the workout notes.',
      };
  }
}

// ---------- Validation helpers ----------

type ValidationResult = { ok: true } | { ok: false; message: string };

function validateTime(value: string): boolean {
  const trimmed = value.trim();
  const re = /^(\d{1,2}):([0-5]\d)$/;
  return re.test(trimmed);
}

function validateRoundsReps(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const re = /^\d+(\+\d+)?$/;
  return re.test(trimmed);
}

function validateInteger(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function validateNumberish(value: string): boolean {
  return /-?\d+(\.\d+)?/.test(value.trim());
}

function validateStrengthScore(
  kind: StrengthScoreKind,
  raw: string,
): ValidationResult {
  const v = raw.trim();
  if (!v) return { ok: false, message: 'Add a strength/skills score.' };

  if (kind === 'weight') {
    if (!validateNumberish(v)) {
      return {
        ok: false,
        message:
          'For load-based strength work, enter a number (e.g. 120 or 120kg).',
      };
    }
    return { ok: true };
  }

  if (kind === 'reps') {
    if (!validateInteger(v)) {
      return {
        ok: false,
        message: 'For rep-based strength work, enter whole reps only (e.g. 45).',
      };
    }
    return { ok: true };
  }

  if (kind === 'time') {
    if (!validateTime(v)) {
      return {
        ok: false,
        message:
          'For time-based strength work, use mm:ss (e.g. 02:30).',
      };
    }
    return { ok: true };
  }

  // other – just require something
  return { ok: true };
}

function validateMainScore(
  scoring: ScoringType | null,
  raw: string,
): ValidationResult {
  const v = raw.trim();
  if (!v) {
    return {
      ok: false,
      message: 'Add a score for the Main WOD or leave it empty.',
    };
  }

  if (!scoring || scoring === 'other') {
    return { ok: true };
  }

  if (scoring === 'for_time') {
    // either mm:ss or rounds+reps
    if (validateTime(v) || validateRoundsReps(v)) return { ok: true };
    return {
      ok: false,
      message:
        'For FOR TIME, enter either finishing time as mm:ss or, if time-capped, rounds+reps (e.g. 7+15).',
    };
  }

  if (scoring === 'amrap') {
    if (!validateRoundsReps(v)) {
      return {
        ok: false,
        message: 'For AMRAP, enter rounds+reps (e.g. 7+12).',
      };
    }
    return { ok: true };
  }

  if (scoring === 'emom') {
    if (!validateInteger(v)) {
      return {
        ok: false,
        message: 'For EMOM, enter total reps (e.g. 85).',
      };
    }
    return { ok: true };
  }

  if (scoring === 'max_load') {
    if (!validateNumberish(v)) {
      return {
        ok: false,
        message: 'For MAX LOAD, enter the heaviest successful load in kg (e.g. 120).',
      };
    }
    return { ok: true };
  }

  return { ok: true };
}

// ---------- Misc helpers ----------

const todayStr = () => new Date().toISOString().slice(0, 10);

const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store' });
  const raw = await r.text();
  const j = raw ? JSON.parse(raw) : {};
  if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);
  return j as T;
}

// ---------- Component ----------

export default function ScorePage() {
  // Date / WOD
  const [date, setDate] = useState(todayStr());
  const [wod, setWod] = useState<WOD | null>(null);
  const [loadingWod, setLoadingWod] = useState(false);

  // Athletes / session
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState<string>('');
  const [role, setRole] = useState<Role>('athlete');
  const [myId, setMyId] = useState<string | null>(null);
  const [loadingAthletes, setLoadingAthletes] = useState(true);

  const isCoach = role === 'coach';

  // Combo box state
  const [athleteInput, setAthleteInput] = useState('');
  const [athleteOpen, setAthleteOpen] = useState(false);

  // Athlete extra info
  const [team, setTeam] = useState('');

  // Strength
  const [rxScaledStrength, setRxScaledStrength] =
    useState<'RX' | 'Scaled'>('RX');
  const [valueStrength, setValueStrength] = useState('');

  // Main WOD
  const [rxScaled, setRxScaled] = useState<'RX' | 'Scaled'>('RX');
  const [valueMain, setValueMain] = useState('');

  // Lists
  const [scoresMain, setScoresMain] = useState<Score[]>([]);
  const [scoresStrength, setScoresStrength] = useState<Score[]>([]);
  const [submittedNames, setSubmittedNames] = useState<string[]>([]); // normalized lowercased names

  const [loadingScores, setLoadingScores] = useState(false);
  const [scoresError, setScoresError] = useState<string | null>(null);

  // Flags from WOD config
  const canRecordMain = wod?.recordMainScore ?? true;
  const canRecordStrength = wod?.strength?.recordScore ?? false;

  // ---------- Load current user + athletes ----------

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingAthletes(true);

        // who am I
        const meRes = await fetch('/api/me', { cache: 'no-store' });
        const meJ = await meRes.json().catch(() => ({} as any));

        if (meRes.ok && meJ?.me) {
          const r: Role = meJ.me.is_coach ? 'coach' : 'athlete';
          setRole(r);
          setMyId(meJ.me.id ?? null);
        }

        // list of athletes
        const r = await fetch('/api/athletes', { cache: 'no-store' });
        const j = await r.json().catch(() => ({} as any));

        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || 'Failed to load athletes');

        const rows = (j.items ?? []) as AthleteRow[];

        const mapped: Athlete[] =
          rows.map((a) => ({
            id: a.id,
            firstName: (a.first_name ?? '').trim() || a.email,
            lastName: (a.last_name ?? '').trim() || '',
            nickname: a.nickname ?? undefined,
            teamName: a.team_name ?? undefined,
            email: a.email,
            phone: a.phone ?? '',
            dob: a.dob ?? '',
          })) ?? [];

        setAthletes(mapped);

        // If user is a regular athlete → auto-select themselves
        if (meJ?.me && !meJ.me.is_coach && meJ.me.id) {
          setAthleteId(meJ.me.id);
        }
      } catch (err) {
        console.error('score: failed to load athletes', err);
        if (alive) setAthletes([]);
      } finally {
        if (alive) setLoadingAthletes(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ---------- Keep athleteInput in sync with athleteId (unless coach clears it manually) ----------

  useEffect(() => {
    const a = athletes.find((x) => x.id === athleteId);
    if (a) {
      setAthleteInput(`${a.firstName} ${a.lastName}`.trim());
    } else if (!isCoach) {
      // athletes: no selection => clear
      setAthleteInput('');
    }
  }, [athleteId, athletes, isCoach]);

  // ---------- Sync team with selected athlete, wipe if null ----------

  useEffect(() => {
    if (!athleteId) {
      setTeam('');
      return;
    }
    const a = athletes.find((x) => x.id === athleteId);
    setTeam(a?.teamName ?? '');
  }, [athleteId, athletes]);

  // ---------- Load WOD on date change (from Supabase via /api/wod) ----------

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingWod(true);
        setWod(null);

        const j = await getJSON<WodApi>(`/api/wod?date=${date}`);
        if (!alive) return;

        if (!j || !j.wod) {
          setWod(null);
        } else {
          const w = j.wod;
          const next: WOD = {
            date,
            title: w.title ?? '',
            description: w.description ?? '',
            scoring: (w.scoring ?? 'for_time') as ScoringType,
            timeCap: w.timeCap ?? '',
            recordMainScore: !!w.recordMainScore,
            strength:
              w.strengthTitle ||
              w.strengthDescription ||
              w.strengthScoreHint
                ? {
                    title: w.strengthTitle ?? '',
                    description: w.strengthDescription ?? '',
                    scoreHint: w.strengthScoreHint ?? '',
                    recordScore: !!w.strengthRecordScore,
                  }
                : undefined,
          };
          setWod(next);
        }
      } catch (e) {
        if (alive) {
          console.error('score: failed to load WOD', e);
          setWod(null);
        }
      } finally {
        if (alive) setLoadingWod(false);
      }
    })();

    // Reset inputs when date changes (but keep selected athlete)
    setValueStrength('');
    setRxScaled('RX');
    setValueMain('');

    return () => {
      alive = false;
    };
  }, [date]);

  // ---------- Load scores from Supabase ----------

  useEffect(() => {
    let cancelled = false;

    async function loadFromApi() {
      setLoadingScores(true);
      setScoresError(null);
      try {
        const params = new URLSearchParams({ date });
        const res = await fetch(`/api/scores?${params.toString()}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          let msg = `Failed to load scores (HTTP ${res.status})`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }

        const j = await res.json();
        if (cancelled) return;

        const rows: ApiScoreRow[] = j.items ?? [];

        const mapped: Score[] = rows.map((row) => {
          const a = row.athlete;
          const fullName =
            [a?.first_name, a?.last_name].filter(Boolean).join(' ') ||
            'Unknown';
          const teamName = a?.team_name ?? undefined;

          return {
            id: row.id,
            athlete: fullName,
            team: teamName,
            rxScaled: row.rx_scaled,
            value: row.score,
            date: row.wod_date,
            part: row.part === 'strength' ? 'strength' : 'main',
          };
        });

        const main = mapped.filter((s) => s.part === 'main');
        const strength = mapped.filter((s) => s.part === 'strength');

        setScoresMain(main);
        setScoresStrength(strength);

        const subs = Array.from(
          new Set(
            mapped
              .map((s) => s.athlete.trim().toLowerCase())
              .filter(Boolean),
          ),
        );
        setSubmittedNames(subs);
      } catch (err: any) {
        console.error('load scores failed', err);
        if (!cancelled) {
          setScoresError(err?.message || 'Failed to load scores');
          setScoresMain([]);
          setScoresStrength([]);
          setSubmittedNames([]);
        }
      } finally {
        if (!cancelled) setLoadingScores(false);
      }
    }

    loadFromApi();

    return () => {
      cancelled = true;
    };
  }, [date]);

  // ---------- Derived values ----------

  const filteredAthletes = useMemo(() => {
    const base = isCoach
      ? athletes
      : athletes.filter((a) => a.id === myId); // athletes see only themselves

    const needle = athleteInput.trim().toLowerCase();
    if (!needle || !isCoach) return base;

    return base.filter((a) => {
      const full = `${a.firstName} ${a.lastName}`.toLowerCase();
      return (
        full.includes(needle) ||
        (a.nickname ?? '').toLowerCase().includes(needle) ||
        (a.teamName ?? '').toLowerCase().includes(needle)
      );
    });
  }, [athletes, isCoach, myId, athleteInput]);

  const selectedAthlete = athletes.find((a) => a.id === athleteId);
  const normalizedName = (
    selectedAthlete ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}` : ''
  )
    .trim()
    .toLowerCase();

  const alreadySubmitted: boolean = normalizedName
    ? submittedNames.includes(normalizedName)
    : false;

  // RX first, then Scaled
  const rxRank = (s: Score) => (s.rxScaled === 'RX' ? 0 : 1);

  // "mm:ss" -> seconds (or just "ss")
  const toSec = (v: string) => {
    const parts = v.split(':').map((n) => parseInt(n || '0', 10));
    if (parts.length === 1) return parts[0] || 0;
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  // AMRAP/EMOM reps: "rounds+reps" → rounds*1000 + reps, else plain integer
  const toRepKey = (v: string) => {
    if (v.includes('+')) {
      const [r, reps] = v.split('+').map((x) => parseInt(x || '0', 10));
      return r * 1000 + (reps || 0);
    }
    return parseInt(v || '0', 10);
  };

  // Strength: take MAX integer from string (kg or reps) — bigger is better
  const toNumberMax = (v: string) => {
    const m = v.match(/-?\d+/g);
    if (!m) return 0;
    return Math.max(...m.map((n) => parseInt(n, 10)));
  };

  // Main WOD leaderboard
  const sortedMain = useMemo(() => {
    const s = [...scoresMain];
    if (!wod) return s;

    if (wod.scoring === 'for_time') {
      // RX first, then time ↑ (smaller is better)
      return s.sort(
        (a, b) => rxRank(a) - rxRank(b) || toSec(a.value) - toSec(b.value),
      );
    }

    // Others (AMRAP, EMOM, max_load, other) → RX first, value ↓ (bigger is better)
    return s.sort(
      (a, b) => rxRank(a) - rxRank(b) || toRepKey(b.value) - toRepKey(a.value),
    );
  }, [scoresMain, wod]);

  // Strength leaderboard: higher number wins
  const sortedStrength = useMemo(() => {
    const s = [...scoresStrength];
    return s.sort((a, b) => toNumberMax(b.value) - toNumberMax(a.value));
  }, [scoresStrength]);

  // Score meta based on WOD / strength configuration
  const strengthKind = useMemo(
    () => inferStrengthScoreKind(wod?.strength),
    [wod],
  );

  const strengthLabel =
    strengthKind === 'weight'
      ? 'Score (kg / load)'
      : strengthKind === 'reps'
      ? 'Score (reps)'
      : strengthKind === 'time'
      ? 'Score (time, mm:ss)'
      : 'Score (Strength / Skills)';

  const strengthPlaceholder =
    strengthKind === 'weight'
      ? 'Heaviest successful load in kg (e.g. 120)'
      : strengthKind === 'reps'
      ? 'Max reps or total reps (e.g. 45)'
      : strengthKind === 'time'
      ? 'Time in mm:ss (e.g. 02:30)'
      : 'e.g. 5x5 @80kg • EMOM 10’ @ bodyweight';

  const mainScoreMeta = useMemo(() => getMainScoreMeta(wod), [wod]);

  // ---------- Submit ----------

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selected = athletes.find((a) => a.id === athleteId);
    const name = selected ? `${selected.firstName} ${selected.lastName}` : '';
    const teamName = team.trim() || undefined;

    const wantStrength = canRecordStrength && valueStrength.trim();
    const wantMain = canRecordMain && valueMain.trim();

    if (!name) return;
    if (!wantStrength && !wantMain) return;

    if (wantStrength) {
      const vRes = validateStrengthScore(strengthKind, valueStrength);
      if (!vRes.ok) {
        alert(vRes.message);
        return;
      }
    }

    if (wantMain) {
      const vRes = validateMainScore(wod?.scoring ?? null, valueMain);
      if (!vRes.ok) {
        alert(vRes.message);
        return;
      }
    }

    const keyName = name.toLowerCase();
    if (submittedNames.includes(keyName)) {
      alert(`You have already submitted for ${fmt(date)}.`);
      return;
    }

    if (
      !window.confirm(
        `Submit scores for ${name} on ${fmt(date)}?\nThis cannot be changed later.`,
      )
    ) {
      return;
    }

    // Persist to Supabase via /api/scores
    try {
      const payload = {
        date,
        athleteId: selected?.id,
        strength: wantStrength
          ? { rxScaled: rxScaledStrength, value: valueStrength.trim() }
          : null,
        main: wantMain
          ? { rxScaled, value: valueMain.trim() }
          : null,
        classSlotId: null as string | null, // will wire class selection later
      };

      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `Failed to save scores (HTTP ${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        alert(msg);
        return;
      }
    } catch (err) {
      console.error('submit scores failed', err);
      alert('Network error while saving scores.');
      return;
    }

    // Local UI update after successful save
    if (wantStrength) {
      const newScoreS: Score = {
        id: crypto.randomUUID(),
        athlete: name,
        team: teamName,
        rxScaled: rxScaledStrength,
        value: valueStrength.trim(),
        date,
        part: 'strength',
      };
      setScoresStrength((prev) => [newScoreS, ...prev]);
      setValueStrength('');
    }

    if (wantMain) {
      const newScoreM: Score = {
        id: crypto.randomUUID(),
        athlete: name,
        team: teamName,
        rxScaled,
        value: valueMain.trim(),
        date,
        part: 'main',
      };
      setScoresMain((prev) => [newScoreM, ...prev]);
      setValueMain('');
    }

    const nextSubmitted = Array.from(new Set([...submittedNames, keyName]));
    setSubmittedNames(nextSubmitted);
  };

  const nameWithNick = (fullName: string) => {
    const [fn, ...rest] = fullName.split(' ');
    const ln = rest.join(' ');
    const m = athletes.find(
      (a) => a.firstName === fn && a.lastName === ln,
    );
    return m?.nickname ? `${fullName} (${m.nickname})` : fullName;
  };

  // ---------- UI ----------

  return (
    <section className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Title */}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Scores</h1>

        {/* Date */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-sm text-zinc-400">Date</span>
          {/* @ts-ignore – DateStepper is JS-only */}
          <DateStepper value={date} onChange={(v: string) => setDate(v)} />
        </div>
      </header>

      {/* Athlete */}
      <div>
        <h2 className="text-lg font-semibold">Athlete</h2>
        <div className="border border-zinc-800 bg-zinc-900 rounded p-3 mb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Combo box: search + select */}
            <div className="relative">
              <label className="block text-sm mb-1 text-zinc-300">
                Athlete <span className="text-red-400">*</span>
              </label>

              <div className="flex items-center gap-1">
                <input
                  value={athleteInput}
                  onChange={(e) => {
                    if (!isCoach) return; // athletes cannot change themselves
                    setAthleteInput(e.target.value);
                    setAthleteOpen(true);
                  }}
                  onFocus={() => {
                    if (isCoach) setAthleteOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setAthleteOpen(false);
                    }
                  }}
                  placeholder={
                    isCoach ? 'Search/select athlete' : 'Your profile'
                  }
                  readOnly={!isCoach}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-sm shadow-sm
                             hover:border-emerald-500/70
                             focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-500
                             transition-colors"
                />

                {isCoach && (
                  <button
                    type="button"
                    onClick={() => {
                      // Clear the visible name and show full list immediately
                      setAthleteInput('');
                      setAthleteOpen(true);
                    }}
                    className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900/80 px-2 py-2 text-xs
                               hover:border-emerald-500/70 hover:bg-zinc-900
                               focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
                    aria-label="Toggle athlete list"
                  >
                    ▾
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {isCoach && athleteOpen && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-lg">
                  {loadingAthletes && (
                    <div className="px-3 py-2 text-xs text-zinc-400">
                      Loading athletes…
                    </div>
                  )}

                  {!loadingAthletes && filteredAthletes.length === 0 && (
                    <div className="px-3 py-2 text-xs text-zinc-400">
                      No athletes found.
                    </div>
                  )}

                  {!loadingAthletes &&
                    filteredAthletes.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setAthleteId(a.id);
                          setAthleteInput(
                            `${a.firstName} ${a.lastName}`.trim(),
                          );
                          setAthleteOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800/80"
                      >
                        <span className="text-zinc-100">
                          {a.lastName}, {a.firstName}
                          {a.nickname && (
                            <span className="text-emerald-400">
                              {`, ${a.nickname}`}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                </div>
              )}

              {!isCoach && (
                <p className="mt-1 text-xs text-zinc-500">
                  As an athlete you can only submit scores for your own profile.
                </p>
              )}
            </div>

            {/* Team */}
            <div>
              <label className="block text-sm mb-1 text-zinc-300">Team</label>
              <input
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900/90 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-600/40 focus:border-emerald-500
                           transition"
                placeholder="e.g. Red"
                readOnly={!isCoach}
              />
            </div>
          </div>

          {alreadySubmitted && (
            <div className="mt-2 text-xs text-amber-400">
              This athlete has already submitted for {fmt(date)}. New submissions
              are blocked.
            </div>
          )}
        </div>
      </div>

      {/* Strength / Skills */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Strength / Skills</h2>

          {canRecordStrength && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 hidden sm:inline">
                RX / Scaled
              </span>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3 accent-emerald-500"
                  checked={rxScaledStrength === 'RX'}
                  onChange={() => setRxScaledStrength('RX')}
                />
                <span className="text-[11px] text-zinc-200">RX</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3 accent-emerald-500"
                  checked={rxScaledStrength === 'Scaled'}
                  onChange={() => setRxScaledStrength('Scaled')}
                />
                <span className="text-[11px] text-zinc-200">Scaled</span>
              </label>
            </div>
          )}
        </div>

        <div className="border border-zinc-800 bg-zinc-900 rounded p-3 space-y-2">
          <div className="text-sm text-zinc-300">
            {wod?.strength?.title
              ? `Part: ${wod.strength.title}`
              : loadingWod
              ? 'Loading Strength / Skills part…'
              : 'No Strength/Skills part set'}
          </div>

          {wod?.strength?.description && (
            <div className="text-xs text-zinc-400 whitespace-pre-line">
              {wod.strength.description}
            </div>
          )}

          {wod?.strength?.scoreHint && (
            <div className="text-xs text-zinc-500 mt-1">
              Hint: {wod.strength.scoreHint}
            </div>
          )}

          {!canRecordStrength ? (
            <p className="text-xs text-zinc-400">
              Score recording for <span className="font-semibold">
                Strength / Skills
              </span>{' '}
              is disabled for {fmt(date)}.
            </p>
          ) : (
            <div className="space-y-1">
              <label className="block text-sm mb-1 text-zinc-300">
                {strengthLabel}
              </label>
              <input
                value={valueStrength}
                onChange={(e) => setValueStrength(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
                placeholder={strengthPlaceholder}
                disabled={!!alreadySubmitted}
              />
            </div>
          )}
        </div>
      </section>

      {/* Main WOD */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">WOD</h2>

          {canRecordMain && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 hidden sm:inline">
                RX / Scaled
              </span>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3 accent-emerald-500"
                  checked={rxScaled === 'RX'}
                  onChange={() => setRxScaled('RX')}
                />
                <span className="text-[11px] text-zinc-200">RX</span>
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  className="h-3 w-3 accent-emerald-500"
                  checked={rxScaled === 'Scaled'}
                  onChange={() => setRxScaled('Scaled')}
                />
                <span className="text-[11px] text-zinc-200">Scaled</span>
              </label>
            </div>
          )}
        </div>

        <div className="border border-zinc-800 bg-zinc-900 rounded p-3 space-y-3">
          {/* WOD info */}
          <div className="text-sm text-zinc-300">
            {loadingWod
              ? 'Loading Main WOD…'
              : wod?.title
              ? `WOD: ${wod.title}`
              : 'No Main WOD set'}
            {wod ? ` • Scoring: ${wod.scoring.toUpperCase()}` : ''}
            {wod?.timeCap ? ` • Time cap: ${wod.timeCap}` : ''}
          </div>
          <div className="text-xs text-zinc-400 whitespace-pre-line">
            {loadingWod ? '' : wod?.description || '—'}
          </div>

          <div>
            <label className="block text-sm mb-1 text-zinc-300">
              {mainScoreMeta.label}
            </label>
            {!canRecordMain ? (
              <p className="text-xs text-zinc-400">
                Score recording for the Main WOD is disabled for {fmt(date)}.
              </p>
            ) : (
              <>
                <input
                  value={valueMain}
                  onChange={(e) => setValueMain(e.target.value)}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
                  placeholder={mainScoreMeta.placeholder}
                  disabled={!!alreadySubmitted}
                />
                {mainScoreMeta.help && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {mainScoreMeta.help}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Submit */}
      <div>
        <button
          type="button"
          onClick={onSubmit}
          className="px-4 py-2 rounded-md border border-emerald-700 text-emerald-300 hover:bg-emerald-950/30 text-sm"
        >
          Submit
        </button>
        {loadingScores && (
          <span className="ml-3 text-xs text-zinc-400">
            Updating scores…
          </span>
        )}
        {scoresError && (
          <div className="mt-1 text-xs text-amber-400">{scoresError}</div>
        )}
      </div>

      {/* Leaderboard */}
      <section className="mt-4 space-y-3">
        <h2 className="text-lg font-semibold text-center">Leaderboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Strength */}
          <div className="border border-zinc-800 rounded bg-zinc-900 p-3">
            <div className="text-sm font-semibold mb-2">Strength</div>
            {scoresStrength.length === 0 ? (
              <p className="text-xs text-zinc-400">
                No scores for {fmt(date)}.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sortedStrength.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500">#{i + 1}</div>
                      <div className="font-medium">
                        {nameWithNick(s.athlete)}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {s.team || ''}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{s.value}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Main WOD */}
          <div className="border border-zinc-800 rounded bg-zinc-900 p-3">
            <div className="text-sm font-semibold mb-2">WOD</div>
            {sortedMain.length === 0 ? (
              <p className="text-xs text-zinc-400">
                No scores for {fmt(date)}.
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sortedMain.map((s, i) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex-1">
                      <div className="text-xs text-zinc-500">#{i + 1}</div>
                      <div className="font-medium">
                        {nameWithNick(s.athlete)}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {s.team ? `${s.team} • ` : ''}
                        {s.rxScaled}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">{s.value}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </section>
  );
}
