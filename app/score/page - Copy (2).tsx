// app/score/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

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
  part?: 'main' | 'strength';
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};

const wodKey = (d: string) => `wod:${d}`;
const scoresKey = (d: string) => `scores:${d}`;
const strengthScoresKey = (d: string) => `scores_strength:${d}`;

export default function ScorePage() {
  // Global/selection
  const [date, setDate] = useState<string>(todayStr());
  const [wod, setWod] = useState<WOD | null>(null);

  // Main WOD inputs
  const [athlete, setAthlete] = useState('');
  const [team, setTeam] = useState('');
  const [rxScaled, setRxScaled] = useState<'RX' | 'Scaled'>('RX');
  const [valueMain, setValueMain] = useState('');

  // Strength inputs
  const [valueStrength, setValueStrength] = useState('');

  // Lists
  const [scoresMain, setScoresMain] = useState<Score[]>([]);
  const [scoresStrength, setScoresStrength] = useState<Score[]>([]);

  // Flags
  const canRecordMain = (wod?.recordMainScore ?? true);
  const canRecordStrength = (wod?.strength?.recordScore ?? false);

  // Load data for date
  useEffect(() => {
    const w = localStorage.getItem(wodKey(date));
    setWod(w ? (JSON.parse(w) as WOD) : null);

    const sMain = localStorage.getItem(scoresKey(date));
    setScoresMain(sMain ? (JSON.parse(sMain) as Score[]) : []);

    const sStr = localStorage.getItem(strengthScoresKey(date));
    setScoresStrength(sStr ? (JSON.parse(sStr) as Score[]) : []);

    // clear inputs when changing date
    setValueMain('');
    setValueStrength('');
  }, [date]);

  // Save helpers
  const saveScoresMain = (list: Score[]) => {
    setScoresMain(list);
    localStorage.setItem(scoresKey(date), JSON.stringify(list));
  };
  const saveScoresStrength = (list: Score[]) => {
    setScoresStrength(list);
    localStorage.setItem(strengthScoresKey(date), JSON.stringify(list));
  };

  // Submit (single button): pushes whichever sections are allowed & filled
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const athleteName = athlete.trim();
    const teamName = team.trim() || undefined;

    let wroteSomething = false;

    if (canRecordStrength && athleteName && valueStrength.trim()) {
      const newScoreS: Score = {
        id: crypto.randomUUID(),
        athlete: athleteName,
        team: teamName,
        rxScaled: 'RX', // not crucial for strength; keep default
        value: valueStrength.trim(),
        date,
        part: 'strength',
      };
      const next = [newScoreS, ...scoresStrength];
      saveScoresStrength(next);
      wroteSomething = true;
      setValueStrength('');
    }

    if (canRecordMain && athleteName && valueMain.trim()) {
      const newScoreM: Score = {
        id: crypto.randomUUID(),
        athlete: athleteName,
        team: teamName,
        rxScaled,
        value: valueMain.trim(),
        date,
        part: 'main',
      };
      const next = [newScoreM, ...scoresMain];
      saveScoresMain(next);
      wroteSomething = true;
      setValueMain('');
    }

    // If nothing was written, you could show a tiny hint (optional)
    // e.g., set a small toast; we keep it silent for now per your flow.
  };

  // Sorting for Main WOD leaderboard
  const sortedMain = useMemo(() => {
    if (!wod) return scoresMain;
    const s = [...scoresMain];
    if (wod.scoring === 'for_time') {
      const toSec = (v: string) => {
        const parts = v.split(':').map((n) => parseInt(n || '0', 10));
        if (parts.length === 1) return parts[0] || 0;
        return (parts[0] || 0) * 60 + (parts[1] || 0);
      };
      return s.sort((a, b) => toSec(a.value) - toSec(b.value));
    }
    // AMRAP / EMOM → higher is better; allow "rounds+reps" or plain reps
    const toRepKey = (v: string) => {
      if (v.includes('+')) {
        const [r, reps] = v.split('+').map((x) => parseInt(x || '0', 10));
        return r * 1000 + (reps || 0);
      }
      return parseInt(v || '0', 10);
    };
    return s.sort((a, b) => toRepKey(b.value) - toRepKey(a.value));
  }, [scoresMain, wod]);

  return (
    <section className="max-w-2xl">
      {/* Title */}
      <h1 className="text-2xl font-bold mb-4">Scores</h1>

      {/* Date (standalone) */}
      <div className="mb-4">
        <label className="block text-sm mb-1 text-zinc-300">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </div>

      {/* Athlete section */}
      <h2 className="text-lg font-semibold">Athlete</h2>
      <div className="border border-zinc-800 bg-zinc-900 rounded p-3 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Name</label>
            <input
              value={athlete}
              onChange={(e) => setAthlete(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              placeholder="e.g. Giannis"
            />
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
      </div>

      {/* Strength / Skills Score */}
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
            />
          </div>
        )}
      </div>

      {/* Main WOD Score */}
      <h2 className="text-lg font-semibold">WOD — Score</h2>
      <div className="border border-zinc-800 bg-zinc-900 rounded p-3 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-sm mb-1 text-zinc-300">RX/Scaled</label>
            <select
              value={rxScaled}
              onChange={(e) => setRxScaled(e.target.value as 'RX' | 'Scaled')}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              disabled={!canRecordMain}
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
              />
            )}
          </div>
        </div>
      </div>

      {/* Single Submit */}
      <form onSubmit={onSubmit}>
        <button className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm">
          Submit
        </button>
      </form>

      {/* Leaderboard (Main WOD) */}
      <h2 className="text-lg font-semibold mt-6 mb-2">Leaderboard — Main WOD</h2>
      <div className="border border-zinc-800 rounded">
        {!canRecordMain ? (
          <div className="p-3 text-sm text-zinc-400">
            Score recording for the Main WOD is disabled.
          </div>
        ) : sortedMain.length === 0 ? (
          <div className="p-3 text-sm text-zinc-400">No scores for {fmt(date)}.</div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {sortedMain.map((s, i) => (
              <li key={s.id} className="p-3 flex items-center gap-3">
                <div className="w-8 text-zinc-400">#{i + 1}</div>
                <div className="flex-1">
                  <div className="font-medium">{s.athlete}</div>
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
    </section>
  );
}
