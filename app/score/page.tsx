// app/score/page.tsx
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import DateStepper from '@/components/DateStepper';
import { useSearchParams } from 'next/navigation';

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

type BookingStatus = {
  hasBooking: boolean;
  hasFinishedBooking: boolean;
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
  classTime?: string | null;
};

type ApiScoreRow = {
  id: string;
  wod_date: string;
  part: 'main' | 'strength';
  rx_scaled: 'RX' | 'Scaled';
  score: string;
  class_slot?: {
    time?: string | null;
  } | null;
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

  if (
    /rm\b|1rm|2rm|3rm|5rm|heavy|max load|load|kg|barbell|snatch|clean|jerk|deadlift|back squat|front squat|press|ohs/.test(
      blob,
    )
  ) {
    return 'weight';
  }

  if (
    /max reps|reps|pull[- ]?ups|push[- ]?ups|burpees|wall balls|double unders|sit[- ]?ups|row|calories/.test(
      blob,
    )
  ) {
    return 'reps';
  }

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
        message:
          'For MAX LOAD, enter the heaviest successful load in kg (e.g. 120).',
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

// "07:00" -> "7 AM", "08:30" -> "8.30 AM", "20:00" -> "8 PM"
function formatClassTimeLabel(raw?: string | null): string {
  if (!raw) return '';
  const [hStr = '0', mStr = '0'] = raw.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return raw;

  const suffix = h < 12 ? 'AM' : 'PM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  const minutePart = m === 0 ? '' : `.${m.toString().padStart(2, '0')}`;
  return `${hour12}${minutePart} ${suffix}`;
}

// ---------- Slide deck for Strength / WOD (mobile, athlete only) ----------

type ScoreDeckProps = {
  left: ReactNode;
  right: ReactNode;
};

function ScoreDeck({ left, right }: ScoreDeckProps) {
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

    node.addEventListener('scroll', onScroll, { passive: true } as any);
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
      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => go(-1)}
          className="hidden sm:block px-2 py-1 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-sm"
        >
          ←
        </button>

        <div className="flex gap-1">
          <span
            className={`h-1.5 w-6 rounded-full ${
              ix === 0 ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          />
          <span
            className={`h-1.5 w-6 rounded-full ${
              ix === 1 ? 'bg-emerald-500' : 'bg-zinc-700'
            }`}
          />
        </div>

        <button
          type="button"
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
        <div className="min-w-full snap-start pr-2">{left}</div>
        <div className="min-w-full snap-start pl-2">{right}</div>
      </div>
    </>
  );
}

// ---------- Component ----------

export default function ScorePage() {
  const searchParams = useSearchParams();
  const initialDateParam = searchParams.get('date');

  const initialDate =
    initialDateParam && /^\d{4}-\d{2}-\d{2}$/.test(initialDateParam)
      ? initialDateParam
      : todayStr();

  // Date / WOD
  const [date, setDate] = useState(initialDate);
  const [wod, setWod] = useState<WOD | null>(null);
  const [loadingWod, setLoadingWod] = useState(false);

  // Athletes / session
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [athleteId, setAthleteId] = useState<string>('');
  const [role, setRole] = useState<Role>('athlete');
  const [myId, setMyId] = useState<string | null>(null);
  const [loadingAthletes, setLoadingAthletes] = useState(true);

  const isCoach = role === 'coach';
  const isAthlete = !isCoach;

  // Combo box state (coach)
  const [athleteInput, setAthleteInput] = useState('');
  const [athleteOpen, setAthleteOpen] = useState(false);

  // Athlete extra info
  const [team, setTeam] = useState('');

  // Strength
  const [rxScaledStrength] = useState<'RX' | 'Scaled'>('RX');
  const [valueStrength, setValueStrength] = useState('');

  // Main WOD
  const [rxScaled, setRxScaled] = useState<'RX' | 'Scaled'>('RX');
  const [valueMain, setValueMain] = useState('');

  // Athlete-only: verify attendance without a score (DNF)
  const [noScore, setNoScore] = useState(false);

  // Lists
  const [scoresMain, setScoresMain] = useState<Score[]>([]);
  const [scoresStrength, setScoresStrength] = useState<Score[]>([]);
  const [submittedNames, setSubmittedNames] = useState<string[]>([]);
  const [scoresReloadKey, setScoresReloadKey] = useState(0);

  const [loadingScores, setLoadingScores] = useState(false);
  const [scoresError, setScoresError] = useState<string | null>(null);

  // Dates where this athlete (or coach-selected athlete) has submitted scores
  const [submittedDates, setSubmittedDates] = useState<string[]>([]);

  // Booking eligibility for current athlete/date (athlete only)
  const [bookingStatus, setBookingStatus] = useState<BookingStatus | null>(null);
  const [bookingStatusLoading, setBookingStatusLoading] = useState(false);

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

        // auto-select self if athlete
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

  // ---------- Keep athleteInput in sync with athleteId (coach) ----------

  useEffect(() => {
    const a = athletes.find((x) => x.id === athleteId);
    if (a) {
      setAthleteInput(`${a.firstName} ${a.lastName}`.trim());
    } else if (!isCoach) {
      setAthleteInput('');
    }
  }, [athleteId, athletes, isCoach]);

  // ---------- Sync team with selected athlete ----------

  useEffect(() => {
    if (!athleteId) {
      setTeam('');
      return;
    }
    const a = athletes.find((x) => x.id === athleteId);
    setTeam(a?.teamName ?? '');
    setNoScore(false);
  }, [athleteId, athletes]);

  // ---------- Load WOD on date change ----------

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

    // reset inputs when date changes
    setValueStrength('');
    setRxScaled('RX');
    setValueMain('');
    setNoScore(false);

    return () => {
      alive = false;
    };
  }, [date]);

  // ---------- Load scores for the day ----------

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
            classTime: row.class_slot?.time
              ? row.class_slot.time.slice(0, 5)
              : null,
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
  }, [date, scoresReloadKey]);

  // ---------- Booking status for selected date (athlete only) ----------

  useEffect(() => {
    if (!myId || isCoach || !date) {
      setBookingStatus(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setBookingStatusLoading(true);
        const params = new URLSearchParams({ date });
        const res = await fetch(`/api/scores/eligibility?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setBookingStatus(null);
          return;
        }
        const j = await res.json();
        if (!cancelled) {
          setBookingStatus({
            hasBooking: !!j.hasBooking,
            hasFinishedBooking: !!j.hasFinishedBooking,
          });
        }
      } catch (err) {
        console.error('score: failed to load booking eligibility', err);
        if (!cancelled) setBookingStatus(null);
      } finally {
        if (!cancelled) setBookingStatusLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, myId, isCoach]);

  // ---------- Load all submitted dates for current athlete (for highlighting) ----------

  useEffect(() => {
    let alive = true;

    async function loadDates() {
      if (!athleteId) {
        setSubmittedDates([]);
        return;
      }
      try {
        const params = new URLSearchParams({ athleteId });
        const res = await fetch(`/api/scores/dates?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;

        const j = await res.json().catch(() => ({} as any));
        if (!alive) return;

        const dates = (j?.dates ?? []) as string[];
        // normalize to YYYY-MM-DD and de-duplicate
        setSubmittedDates(
          Array.from(
            new Set(
              dates.map((d) => d.trim().slice(0, 10)),
            ),
          ),
        );
      } catch (err) {
        if (!alive) return;
        console.error('Failed to load score dates', err);
      }
    }

    loadDates();
    return () => {
      alive = false;
    };
  }, [athleteId]);

  // ---------- Derived values ----------

  const filteredAthletes = useMemo(() => {
    const base = isCoach
      ? athletes
      : athletes.filter((a) => a.id === myId);

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
    selectedAthlete
      ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}`
      : ''
  )
    .trim()
    .toLowerCase();

  const alreadySubmitted: boolean = normalizedName
    ? submittedNames.includes(normalizedName)
    : false;

  // leaderboard helpers
  const rxRank = (s: Score) => (s.rxScaled === 'RX' ? 0 : 1);

  const toSec = (v: string) => {
    const parts = v.split(':').map((n) => parseInt(n || '0', 10));
    if (parts.length === 1) return parts[0] || 0;
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  const toRepKey = (v: string) => {
    if (v.includes('+')) {
      const [r, reps] = v.split('+').map((x) => parseInt(x || '0', 10));
      return r * 1000 + (reps || 0);
    }
    return parseInt(v || '0', 10);
  };

  const toNumberMax = (v: string) => {
    const m = v.match(/-?\d+/g);
    if (!m) return 0;
    return Math.max(...m.map((n) => parseInt(n, 10)));
  };

  const isDNF = (v: string) => v.trim().toUpperCase() === 'DNF';

  const sortedMain = useMemo(() => {
    const s = [...scoresMain];
    if (!wod) return s;

    const nonDNF = s.filter((sc) => !isDNF(sc.value));
    const dnf = s.filter((sc) => isDNF(sc.value));

    if (wod.scoring === 'for_time') {
      const finished = nonDNF.filter((sc) => validateTime(sc.value));
      const capped = nonDNF.filter((sc) => !validateTime(sc.value));

      finished.sort(
        (a, b) =>
          rxRank(a) - rxRank(b) || toSec(a.value) - toSec(b.value),
      );

      capped.sort(
        (a, b) =>
          rxRank(a) - rxRank(b) ||
          toRepKey(b.value) - toRepKey(a.value),
      );

      return [...finished, ...capped, ...dnf];
    }

    nonDNF.sort(
      (a, b) => rxRank(a) - rxRank(b) || toRepKey(b.value) - toRepKey(a.value),
    );

    return [...nonDNF, ...dnf];
  }, [scoresMain, wod]);

  const sortedStrength = useMemo(() => {
    const s = [...scoresStrength];
    const nonDNF = s.filter((sc) => !isDNF(sc.value));
    const dnf = s.filter((sc) => isDNF(sc.value));

    nonDNF.sort((a, b) => toNumberMax(b.value) - toNumberMax(a.value));
    return [...nonDNF, ...dnf];
  }, [scoresStrength]);

  const strengthKind = useMemo(
    () => inferStrengthScoreKind(wod?.strength),
    [wod],
  );

  const strengthLabel = 'Score (Load / KG / Reps)';

  const strengthPlaceholder =
    wod?.strength?.scoreHint && wod.strength.scoreHint.trim()
      ? wod.strength.scoreHint
      : strengthKind === 'weight'
      ? 'Heaviest successful load in kg (e.g. 120)'
      : strengthKind === 'reps'
      ? 'Max reps or total reps (e.g. 45)'
      : strengthKind === 'time'
      ? 'Time in mm:ss (e.g. 02:30)'
      : 'e.g. 5x5 @80kg • EMOM 10’ @ bodyweight';

  const mainScoreMeta = useMemo(() => getMainScoreMeta(wod), [wod]);

  const isRestDay = useMemo(() => {
    if (!date) return false;
    const [y, m, d] = date.split('-').map(Number);
    if (!y || !m || !d) return false;
    const jsDate = new Date(y, m - 1, d);
    // 0 = Sunday
    return jsDate.getDay() === 0;
  }, [date]);

  // ---- athlete eligibility for form ----
  const canSubmitAsAthlete =
    isAthlete &&
    bookingStatus?.hasFinishedBooking &&
    (canRecordMain || canRecordStrength) &&
    !alreadySubmitted;

  const showForm = isCoach || canSubmitAsAthlete;

  let athleteScoreMessage: string | null = null;
  if (isAthlete && !alreadySubmitted) {
    if (bookingStatusLoading) {
      athleteScoreMessage = 'Checking your booking for this day...';
    } else if (!bookingStatus?.hasBooking) {
      athleteScoreMessage =
        'You have no booking for this date. You can only add a score for a class you booked.';
    } else if (bookingStatus.hasBooking && !bookingStatus.hasFinishedBooking) {
      athleteScoreMessage =
        'Score submission will be available after your class ends.';
    } else if (!(canRecordMain || canRecordStrength)) {
      athleteScoreMessage = 'Score recording is disabled for this WOD.';
    }
  }

  const nameWithNick = (fullName: string) => {
    return <span>{fullName}</span>;
  };

  // ---------- Submit ----------

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selected = athletes.find((a) => a.id === athleteId);
    const name = selected ? `${selected.firstName} ${selected.lastName}` : '';
    const teamName = team.trim() || undefined;

    // Athlete checked "Don't remember / Don't want to record a score"
    const dnf = !isCoach && noScore;

    const wantStrength =
      canRecordStrength && !dnf && valueStrength.trim();
    const wantMain =
      canRecordMain && (dnf || valueMain.trim());

    if (!name) return;
    if (!wantStrength && !wantMain) return;

    // validate strength
    if (wantStrength) {
      const vRes = validateStrengthScore(strengthKind, valueStrength);
      if (!vRes.ok) {
        alert(vRes.message);
        return;
      }
    }

    // validate main (only when not DNF)
    if (!dnf && canRecordMain && valueMain.trim()) {
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

    let chargeCredit = false;
    if (isCoach) {
      chargeCredit = window.confirm(
        'Do you also want to charge 1 credit for this athlete for this class day?',
      );
    }

    const confirmMessage = dnf
      ? `Verify attendance for ${name} on ${fmt(
          date,
        )}?\nScore for the WOD will be recorded as DNF.`
      : `Submit scores for ${name} on ${fmt(
          date,
        )}?\nThis cannot be changed later.`;

    if (!window.confirm(confirmMessage)) {
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
          ? { rxScaled, value: dnf ? 'DNF' : valueMain.trim() }
          : null,
        classSlotId: null as string | null,
        noScore: dnf,
        chargeCredit,
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

      // Notify reminder banner
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('score-submitted'));
      }
    } catch (err) {
      console.error('submit scores failed', err);
      alert('Network error while saving scores.');
      return;
    }

    // Local UI update
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
        value: dnf ? 'DNF' : valueMain.trim(),
        date,
        part: 'main',
      };
      setScoresMain((prev) => [newScoreM, ...prev]);
      if (!dnf) setValueMain('');
    }

    const nextSubmitted = Array.from(new Set([...submittedNames, keyName]));
    setSubmittedNames(nextSubmitted);
    setScoresReloadKey((k) => k + 1);
  };

  // ---------- Section renderers ----------

  const renderStrengthSection = () => (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Strength / Skills</h2>
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

        {!canRecordStrength ? (
          <p className="text-xs text-zinc-400">
            Score recording for{' '}
            <span className="font-semibold">Strength / Skills</span>{' '}
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
              disabled={!!alreadySubmitted || (!isCoach && noScore)}
            />
          </div>
        )}
      </div>
    </section>
  );

  const renderMainWodSection = () => (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">WOD</h2>

        {canRecordMain && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-400 hidden sm:inline">RX / Scaled</span>
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
                disabled={!!alreadySubmitted || (!isCoach && noScore)}
              />
              {mainScoreMeta.help && (
                <p className="mt-1 text-xs text-zinc-500">
                  {mainScoreMeta.help}
                </p>
              )}
              {!isCoach && (
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    className="h-3 w-3 accent-emerald-500"
                    checked={noScore}
                    onChange={(e) => {
                      setNoScore(e.target.checked);
                      if (e.target.checked) {
                        setValueMain('');
                        setValueStrength('');
                      }
                    }}
                  />
                  <span>
                    Don&apos;t remember / Don&apos;t want to record a score – just
                    verify my attendance.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );

  // ---------- UI ----------

  return (
    <section className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Title + Date */}
      <header className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold text-center">Scores</h1>

        <div className="flex justify-center w-full">
          {/* @ts-ignore – DateStepper is JS-only */}
          <DateStepper
            value={date}
            onChange={(v: string) => setDate(v)}
            highlightedDates={submittedDates}
          />
        </div>
      </header>

      {isRestDay ? (
        // ---------- REST DAY ----------
        <div className="text-center text-zinc-400 py-10 text-lg">
          Rest Day – No WOD for today.
        </div>
      ) : (
        // ---------- NORMAL DAY UI ----------
        <>
          {/* Athlete section – ONLY for coaches */}
          {isCoach && (
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
                          if (!isCoach) return;
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
                        placeholder="Search/select athlete"
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
                                  <span className="text-yellow-400">
                                    {`, ${a.nickname}`}
                                  </span>
                                )}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Team */}
                  <div>
                    <label className="block text-sm mb-1 text-zinc-300">
                      Team
                    </label>
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
                    This athlete has already submitted for {fmt(date)}. New
                    submissions are blocked.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SCORE FORM / MESSAGES */}
          {showForm ? (
            <>
              {/* Athlete: slider logic depends on which parts can record */}
              {!isCoach ? (
                <>
                  <div className="sm:hidden">
                    {canRecordStrength && canRecordMain ? (
                      <ScoreDeck
                        left={renderStrengthSection()}
                        right={renderMainWodSection()}
                      />
                    ) : canRecordStrength ? (
                      renderStrengthSection()
                    ) : canRecordMain ? (
                      renderMainWodSection()
                    ) : null}
                  </div>

                  <div className="hidden sm:block space-y-4">
                    {canRecordStrength && renderStrengthSection()}
                    {canRecordMain && renderMainWodSection()}
                  </div>
                </>
              ) : (
                // Coach: always stacked, both sections rendered
                <div className="space-y-4">
                  {renderStrengthSection()}
                  {renderMainWodSection()}
                </div>
              )}

              {/* Submit button only when form is visible */}
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
                  <div className="mt-1 text-xs text-amber-400">
                    {scoresError}
                  </div>
                )}
              </div>
            </>
          ) : isAthlete && !alreadySubmitted && athleteScoreMessage ? (
            <div className="border border-zinc-800 bg-zinc-900 rounded p-3 text-sm text-zinc-300">
              {athleteScoreMessage}
            </div>
          ) : null}

{/* Leaderboard — always visible on non-rest days */}
<section className="mt-4 space-y-3">
  <h2 className="text-lg font-semibold text-center">Leaderboard</h2>
  <p className="text-center text-[11px] text-zinc-400 flex items-center justify-center gap-3 mt-1">
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm bg-red-900/40 border border-red-800/40" />
      RX
    </span>
    <span className="flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm bg-green-900/40 border border-green-800/40" />
      Scaled
    </span>
  </p>

  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {/* Strength */}
    <div className="border border-zinc-800 rounded bg-zinc-900 p-3">
      {/* Mini tab with strength info (if exists) */}
      {wod?.strength && (
        <div className="mb-2 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Strength / Skills
          </div>
          <div className="text-sm text-zinc-100">
            {wod.strength.title || 'Strength / Skills'}
          </div>
          {wod.strength.description && (
            <div className="mt-1 text-[11px] text-zinc-400 whitespace-pre-line line-clamp-2">
              {wod.strength.description}
            </div>
          )}
        </div>
      )}

      <div className="text-sm font-semibold mb-2">Strength</div>
      {sortedStrength.length === 0 ? (
        <p className="text-xs text-zinc-400">
          No scores for {fmt(date)}.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {sortedStrength.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md px-3 py-1.5 border border-zinc-800 bg-zinc-900/40"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] text-zinc-400">
                  #{i + 1}
                </span>

                <span className="truncate">
                  {nameWithNick(s.athlete)}
                </span>

                {s.classTime && (
                  <span className="text-[11px] text-emerald-400">
                    {formatClassTimeLabel(s.classTime)}
                  </span>
                )}
              </div>

              <div className="text-sm font-semibold shrink-0">
                {s.value}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>

    {/* Main WOD */}
    <div className="border border-zinc-800 rounded bg-zinc-900 p-3">
      {/* Mini tab with WOD info (if exists) */}
      {wod && (
        <div className="mb-2 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Main WOD
          </div>
          <div className="text-sm text-zinc-100">
            {wod.title || 'WOD'}
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">
            {wod.timeCap
              ? `Time cap: ${wod.timeCap} • Scoring: ${wod.scoring.toUpperCase()}`
              : `Scoring: ${wod.scoring.toUpperCase()}`}
          </div>
          {wod.description && (
            <div className="mt-1 text-[11px] text-zinc-400 whitespace-pre-line line-clamp-2">
              {wod.description}
            </div>
          )}
        </div>
      )}

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
              className={
                'flex items-center justify-between gap-3 rounded-md px-3 py-1.5 border ' +
                (s.rxScaled === 'RX'
                  ? 'bg-red-900/20 border-red-800/30'
                  : 'bg-green-900/20 border-green-800/30')
              }
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] text-zinc-400">
                  #{i + 1}
                </span>

                <span className="truncate">
                  {nameWithNick(s.athlete)}
                </span>

                {s.classTime && (
                  <span className="text-[11px] text-emerald-400">
                    {formatClassTimeLabel(s.classTime)}
                  </span>
                )}
              </div>

              <div className="text-sm font-semibold shrink-0">
                {s.value}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
</section>

        </>
      )}
    </section>
  );
}
