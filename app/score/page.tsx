// app/score/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import DateStepper from '@/components/DateStepper';

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
const keyAthletes = 'athletes';





type ScoringType = 'for_time' | 'amrap' | 'emom';

type StrengthPart = { title: string; description: string; scoreHint: string; recordScore?: boolean };

type WOD = {
  date: string; // ISO YYYY-MM-DD
  title: string;
  description: string;
  scoring: ScoringType;
  timeCap: string;
  strength?: StrengthPart;
  recordMainScore?: boolean;
};

type Score = {
  id: string;
  athlete: string;
  team?: string;
  rxScaled: 'RX' | 'Scaled';
  value: string;
  date: string;
  part: 'main' | 'strength';
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

const wodKey = (d: string) => `wod:${d}`;
const scoresKey = (d: string) => `scores:${d}`;                      // main WOD
const strengthScoresKey = (d: string) => `scores_strength:${d}`;     // strength
const submittedKey = (d: string) => `submitted:${d}`;                // per-day submissions

export default function ScorePage() {
  // Selection
  const [date, setDate] = useState<string>(todayStr());
  const [wod, setWod] = useState<WOD | null>(null);

  const [athletes, setAthletes] = useState<Athlete[]>([]);
const [athleteId, setAthleteId] = useState<string>(''); // αντί για free-text name

useEffect(() => {
  const raw = localStorage.getItem(keyAthletes);
  setAthletes(raw ? (JSON.parse(raw) as Athlete[]) : []);
}, []); // μία φορά

  // Athlete (shared)
  const [athlete, setAthlete] = useState('');
  const [team, setTeam] = useState('');

  // Strength
  const [valueStrength, setValueStrength] = useState('');

  // Main WOD
  const [rxScaled, setRxScaled] = useState<'RX' | 'Scaled'>('RX');
  const [valueMain, setValueMain] = useState('');

  // Lists
  const [scoresMain, setScoresMain] = useState<Score[]>([]);
  const [scoresStrength, setScoresStrength] = useState<Score[]>([]);
  const [submittedNames, setSubmittedNames] = useState<string[]>([]); // normalized lowercased names

  // Flags from WOD config
  const canRecordMain = (wod?.recordMainScore ?? true);
  const canRecordStrength = (wod?.strength?.recordScore ?? false);
  
useEffect(() => {
  if (!athleteId) return;
  const a = athletes.find(x => x.id === athleteId);
  // Αν υπάρχει teamName, βάλε το στο πεδίο Team — overwrite
  if (a?.teamName) setTeam(a.teamName);
}, [athleteId, athletes]);

useEffect(() => {
  if (!athleteId) {
    // Καμία επιλογή -> καθάρισε team
    setTeam('');
    return;
  }
  const a = athletes.find(x => x.id === athleteId);
  // Αν έχει teamName -> βάλε το. Αλλιώς καθάρισε.
  setTeam(a?.teamName ?? '');
}, [athleteId, athletes]);

  // Load data for date
  useEffect(() => {
    const w = localStorage.getItem(wodKey(date));
    setWod(w ? (JSON.parse(w) as WOD) : null);

    const sMain = localStorage.getItem(scoresKey(date));
    setScoresMain(sMain ? (JSON.parse(sMain) as Score[]) : []);

    const sStr = localStorage.getItem(strengthScoresKey(date));
    setScoresStrength(sStr ? (JSON.parse(sStr) as Score[]) : []);

    const subs = localStorage.getItem(submittedKey(date));
    setSubmittedNames(subs ? (JSON.parse(subs) as string[]) : []);

    // clear inputs on date change
    setAthlete('');
    setTeam('');
    setValueStrength('');
    setRxScaled('RX');
    setValueMain('');
  }, [date]);

  // Helpers to persist
  const saveScoresMain = (list: Score[]) => {
    setScoresMain(list);
    localStorage.setItem(scoresKey(date), JSON.stringify(list));
  };
  const saveScoresStrength = (list: Score[]) => {
    setScoresStrength(list);
    localStorage.setItem(strengthScoresKey(date), JSON.stringify(list));
  };
  const saveSubmitted = (names: string[]) => {
    setSubmittedNames(names);
    localStorage.setItem(submittedKey(date), JSON.stringify(names));
  };



  // Derived: one-submit-per-day check
const selectedAthlete = athletes.find(a => a.id === athleteId);
const normalizedName = (selectedAthlete ? `${selectedAthlete.firstName} ${selectedAthlete.lastName}` : '')
  .trim()
  .toLowerCase();
const alreadySubmitted: boolean = normalizedName ? submittedNames.includes(normalizedName) : false;

// RX πρώτα, μετά Scaled
const rxRank = (s: Score) => (s.rxScaled === 'RX' ? 0 : 1);

// "mm:ss" -> seconds (ή απλά "ss")
const toSec = (v: string) => {
  const parts = v.split(':').map((n) => parseInt(n || '0', 10));
  if (parts.length === 1) return parts[0] || 0;
  return (parts[0] || 0) * 60 + (parts[1] || 0);
};

// AMRAP/EMOM reps: "rounds+reps" → rounds*1000 + reps, αλλιώς σκέτο ακέραιο
const toRepKey = (v: string) => {
  if (v.includes('+')) {
    const [r, reps] = v.split('+').map((x) => parseInt(x || '0', 10));
    return r * 1000 + (reps || 0);
  }
  return parseInt(v || '0', 10);
};

// Strength: πάρε το ΜΕΓΙΣΤΟν ακέραιο από το string (kg ή reps) — μεγαλύτερο = καλύτερο
const toNumberMax = (v: string) => {
  const m = v.match(/-?\d+/g);
  if (!m) return 0;
  return Math.max(...m.map((n) => parseInt(n, 10)));
};

  // Sorting for Main WOD leaderboard
const sortedMain = useMemo(() => {
  const s = [...scoresMain];
  if (!wod) return s;

  if (wod.scoring === 'for_time') {
    // RX πρώτα, μετά χρόνος ↑ (μικρότερος καλύτερος)
    return s.sort((a, b) => rxRank(a) - rxRank(b) || toSec(a.value) - toSec(b.value));
  }

  // AMRAP / EMOM → RX πρώτα, μετά reps ↓ (μεγαλύτερο καλύτερο)
  return s.sort((a, b) => rxRank(a) - rxRank(b) || toRepKey(b.value) - toRepKey(a.value));
}, [scoresMain, wod]);


  // Strength leaderboard (simple: newest first)
const sortedStrength = useMemo(() => {
  // Μετριέται σε κιλά ή επαναλήψεις → μεγαλύτερος ακέραιος καλύτερα
  const s = [...scoresStrength];
  return s.sort((a, b) => toNumberMax(b.value) - toNumberMax(a.value));
}, [scoresStrength]);


  // Single submit handler (no overwrite)
 const onSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  // από το dropdown
  const selected = athletes.find(a => a.id === athleteId);
  const name = selected ? `${selected.firstName} ${selected.lastName}` : '';
  const teamName = team.trim() || undefined;

  const wantStrength = canRecordStrength && valueStrength.trim();
  const wantMain = canRecordMain && valueMain.trim();

  if (!name) return;
  if (!wantStrength && !wantMain) return;

  // block αν έχει ήδη κάνει submit σήμερα
  const keyName = name.toLowerCase();
  if (submittedNames.includes(keyName)) {
    alert(`You have already submitted for ${fmt(date)}.`);
    return;
  }

  // Confirm
  if (!window.confirm(`Submit scores for ${name} on ${fmt(date)}?\nThis cannot be changed later.`)) {
    return;
  }

  if (wantStrength) {
    const newScoreS: Score = {
      id: crypto.randomUUID(),
      athlete: name,
      team: teamName,
      rxScaled: 'RX',
      value: valueStrength.trim(),
      date,
      part: 'strength',
    };
    saveScoresStrength([newScoreS, ...scoresStrength]);
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
    saveScoresMain([newScoreM, ...scoresMain]);
    setValueMain('');
  }

  // μαρκάρισμα “έκανε submit σήμερα”
  const nextSubmitted = Array.from(new Set([...submittedNames, keyName]));
  saveSubmitted(nextSubmitted);
};

const nameWithNick = (fullName: string) => {
  const [fn, ...rest] = fullName.split(' ');
  const ln = rest.join(' ');
  const m = athletes.find(a => a.firstName === fn && a.lastName === ln);
  return m?.nickname ? `${fullName} (${m.nickname})` : fullName;
};

  return (
    <section className="max-w-3xl">
      {/* Title */}
      <h1 className="text-2xl font-bold mb-4">Scores</h1>

      {/* Date (standalone) */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-zinc-300">Date</label>
<DateStepper value={date} onChange={setDate} />
      </div>

{/* Athlete */}
<h2 className="text-lg font-semibold">Athlete</h2>
<div className="border border-zinc-800 bg-zinc-900 rounded p-3 mb-5">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div>
      <label className="block text-sm mb-1 text-zinc-300">
        Athlete <span className="text-red-400">*</span>
      </label>
      <select
        value={athleteId}
        onChange={(e) => setAthleteId(e.target.value)}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
      >
        <option value="">— Select athlete —</option>
        {athletes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.lastName}, {a.firstName}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label className="block text-sm mb-1 text-zinc-300">Team (optional)</label>
      <input
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
        placeholder="e.g. Red"
      />
    </div>
  </div>

  {alreadySubmitted && (
    <div className="mt-2 text-xs text-amber-400">
      This athlete has already submitted for {fmt(date)}. New submissions are blocked.
    </div>
  )}
</div>


      {/* Strength / Skills — Score */}
      <h2 className="text-lg font-semibold">Strength / Skills — Score</h2>
      <div className="border border-zinc-800 bg-zinc-900 rounded p-3 mb-5">
        <div className="text-sm text-zinc-400 mb-2">
          {wod?.strength?.title ? `Part: ${wod.strength.title}` : 'No Strength/Skills part set'}
          {wod?.strength?.scoreHint ? ` • Hint: ${wod.strength.scoreHint}` : ''}
        </div>
        {!canRecordStrength ? (
          <div className="p-3 border border-zinc-800 bg-zinc-900 rounded text-sm text-zinc-300">
            Score recording for <span className="font-semibold">Strength / Skills</span> is <span className="font-semibold">disabled</span> for {fmt(date)}.
          </div>
        ) : (
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Score (Strength / Skills)</label>
            <input
              value={valueStrength}
              onChange={(e) => setValueStrength(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              placeholder="e.g. 5x5 @80kg • EMOM 10’ @ bodyweight"
              disabled={!!alreadySubmitted}
            />
          </div>
        )}
      </div>

      {/* Main WOD — Score */}
      <h2 className="text-lg font-semibold">WOD — Score</h2>
      <div className="border border-zinc-800 bg-zinc-900 rounded p-3 mb-5">

        {/* WOD info (title / scoring / timecap / description) */}
<div className="text-sm text-zinc-400 mb-2">
  {wod?.title ? `WOD: ${wod.title}` : 'No Main WOD set'}
  {wod ? ` • Scoring: ${wod.scoring.toUpperCase()}` : ''}
  {wod?.timeCap ? ` • Time cap: ${wod.timeCap}` : ''}
</div>
<div className="text-sm text-zinc-300 whitespace-pre-wrap mb-3">
  {wod?.description || '—'}
</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-sm mb-1 text-zinc-300">RX/Scaled</label>
            <select
              value={rxScaled}
              onChange={(e) => setRxScaled(e.target.value as 'RX' | 'Scaled')}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              disabled={!canRecordMain || !!alreadySubmitted}
            >
              <option>RX</option>
              <option>Scaled</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1 text-zinc-300">Score (Main WOD)</label>
            {!canRecordMain ? (
              <div className="p-3 border border-zinc-800 bg-zinc-900 rounded text-sm text-zinc-300">
                Score recording for the <span className="font-semibold">Main WOD</span> is <span className="font-semibold">disabled</span> for {fmt(date)}.
              </div>
            ) : (
              <input
                value={valueMain}
                onChange={(e) => setValueMain(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
                placeholder="FOR TIME: mm:ss • AMRAP/EMOM: rounds+reps (e.g. 7+12)"
                disabled={!!alreadySubmitted}
              />
            )}
          </div>
        </div>
      </div>

      {/* Single Submit */}
      <form onSubmit={onSubmit} className="mb-6">
        <button
          className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
          disabled={!!alreadySubmitted}
          title={alreadySubmitted ? `Already submitted for ${fmt(date)}` : 'Submit'}
        >
          Submit
        </button>
      </form>

      {/* Leaderboard title */}
      <h2 className="text-lg font-semibold text-center mb-3">Leaderboard</h2>

      {/* Two columns: Strength (left) / WOD (right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strength column */}
        <div className="border border-zinc-800 rounded">
          <div className="px-3 py-2 border-b border-zinc-800 font-semibold">Strength</div>
          {scoresStrength.length === 0 ? (
            <div className="p-3 text-sm text-zinc-400">No scores for {fmt(date)}.</div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {sortedStrength.map((s, i) => (
                <li key={s.id} className="p-3 flex items-center gap-3">
                  <div className="w-8 text-zinc-400">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="font-medium">{nameWithNick(s.athlete)}</div>
                    <div className="text-xs text-zinc-400">{s.team || ''}</div>
                  </div>
                  <div className="text-sm font-semibold">{s.value}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Main WOD column */}
        <div className="border border-zinc-800 rounded">
          <div className="px-3 py-2 border-b border-zinc-800 font-semibold">WOD</div>
          {sortedMain.length === 0 ? (
            <div className="p-3 text-sm text-zinc-400">No scores for {fmt(date)}.</div>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {sortedMain.map((s, i) => (
                <li key={s.id} className="p-3 flex items-center gap-3">
                  <div className="w-8 text-zinc-400">#{i + 1}</div>
                  <div className="flex-1">
                    <div className="font-medium">{nameWithNick(s.athlete)}</div>
                    <div className="text-xs text-zinc-400">
                      {s.team ? `${s.team} • ` : ''}{s.rxScaled}
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
  );
}
