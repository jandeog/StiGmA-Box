// app/score/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';


type WOD = {
  date: string;
  title: string;
  description: string;
  scoring: 'For Time' | 'AMRAP' | 'EMOM';
  timeCap: string;
  strength?: { title: string; description: string; scoreHint: string; recordScore?: boolean };
  recordMainScore?: boolean;
};

type Score = {
  id: string;
  athlete: string;
  team?: string;
  rxScaled: 'RX' | 'Scaled';
  value: string; // μορφή ανά scoring
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
  const [date, setDate] = useState(todayStr());
  const [wod, setWod] = useState<WOD | null>(null);
  const [athlete, setAthlete] = useState('');
  const [team, setTeam] = useState('');
  const [rxScaled, setRxScaled] = useState<'RX' | 'Scaled'>('RX');
  const [value, setValue] = useState('');
  const [scores, setScores] = useState<Score[]>([]);
  const canRecord = (wod?.recordMainScore ?? true);

  // Strength inputs
const [athleteS, setAthleteS] = useState('');
const [teamS, setTeamS] = useState('');
const [valueS, setValueS] = useState('');

// Strength scores list
const [scoresStrength, setScoresStrength] = useState<Score[]>([]);

const canRecordMain = (wod?.recordMainScore ?? true);
const canRecordStrength = (wod?.strength?.recordScore ?? false);

  useEffect(() => {
    const w = localStorage.getItem(wodKey(date));
    setWod(w ? (JSON.parse(w) as WOD) : null);
    const s = localStorage.getItem(scoresKey(date));
    setScores(s ? (JSON.parse(s) as Score[]) : []);
     const sStr = localStorage.getItem(strengthScoresKey(date));
  setScoresStrength(sStr ? (JSON.parse(sStr) as Score[]) : []);
    setValue('');
    setValueS('');
  }, [date]);

  const saveScores = (list: Score[]) => {
    setScores(list);
    localStorage.setItem(scoresKey(date), JSON.stringify(list));
  };

  const saveScoresStrength = (list: Score[]) => {
  setScoresStrength(list);
  localStorage.setItem(strengthScoresKey(date), JSON.stringify(list));
};

  const addScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!athlete.trim() || !value.trim()) return;
    const newScore: Score = {
      id: crypto.randomUUID(),
      athlete: athlete.trim(),
      team: team.trim() || undefined,
      rxScaled,
      value: value.trim(),
      date,
    };
    const list = [newScore, ...scores];
    saveScores(list);
    setValue('');
  };
  
const addScoreStrength = (e: React.FormEvent) => {
  e.preventDefault();
  if (!athleteS.trim() || !valueS.trim()) return;
  const newScore: Score = {
    id: crypto.randomUUID(),
    athlete: athleteS.trim(),
    team: teamS.trim() || undefined,
    rxScaled: 'RX', // δεν είναι κρίσιμο για Strength, το κρατάμε σταθερό/αγνοείται
    value: valueS.trim(), // ελεύθερο πεδίο (π.χ. 5x5 @80kg)
    date,
    part: 'strength',
  };
  const list = [newScore, ...scoresStrength];
  saveScoresStrength(list);
  setValueS('');
};

  const sorted = useMemo(() => {
    if (!wod) return scores;
    if (wod.scoring === 'For Time') {
      const toSec = (v: string) => {
        const parts = v.split(':').map((n) => parseInt(n || '0', 10));
        if (parts.length === 1) return parts[0] || 0;
        return (parts[0] || 0) * 60 + (parts[1] || 0);
      };
      return [...scores].sort((a, b) => toSec(a.value) - toSec(b.value));
    }
    // AMRAP
    const toReps = (v: string) => {
      if (v.includes('+')) {
        const [r, reps] = v.split('+').map((x) => parseInt(x || '0', 10));
        return r * 1000 + (reps || 0);
      }
      return parseInt(v || '0', 10);
    };
    return [...scores].sort((a, b) => toReps(b.value) - toReps(a.value));
  }, [scores, wod]);

  return (
    <section className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Scores (demo)</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1 text-zinc-300">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </div>
        <div className="md:col-span-2 border border-zinc-800 bg-zinc-900 rounded p-3">
          <div className="text-sm text-zinc-400">Today: {fmt(date)}</div>
          <div className="font-semibold">{wod?.title || 'No WOD set'}</div>
          {wod?.timeCap && <div className="text-sm text-zinc-400">Time cap: {wod.timeCap}</div>}
          {wod && <div className="text-sm text-zinc-400">Scoring: {wod.scoring}</div>}
          {wod && (
  <div className="text-xs text-zinc-500 mt-1">
    Recording: {canRecord ? 'On' : 'Off'}
  </div>
)}
{/* Strength / Skills score input */}
<h2 className="text-lg font-semibold mt-8 mb-2">Strength / Skills — Score</h2>
<div className="border border-zinc-800 bg-zinc-900 rounded p-3">
  <div className="text-sm text-zinc-400 mb-2">
    {wod?.strength?.title ? `Part: ${wod.strength.title}` : 'No Strength/Skills part set'}
    {wod?.strength?.scoreHint ? ` • Hint: ${wod.strength.scoreHint}` : ''}
  </div>

  {!canRecordStrength ? (
    <div className="p-3 border border-zinc-800 bg-zinc-900 rounded text-sm text-zinc-300">
      Score recording for <span className="font-semibold">Strength / Skills</span> is <span className="font-semibold">disabled</span> for {fmt(date)}.
    </div>
  ) : (
    <form onSubmit={addScoreStrength} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm mb-1 text-zinc-300">Athlete name</label>
          <input
            value={athleteS}
            onChange={(e) => setAthleteS(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
            placeholder="e.g. Giannis"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-zinc-300">Team (optional)</label>
          <input
            value={teamS}
            onChange={(e) => setTeamS(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
            placeholder="e.g. Red"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm mb-1 text-zinc-300">Score (Strength / Skills)</label>
        <input
          value={valueS}
          onChange={(e) => setValueS(e.target.value)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          placeholder="e.g. 5x5 @80kg • EMOM 10’ @ bodyweight"
        />
      </div>

      <button className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm">
        Submit
      </button>
    </form>
  )}
</div>

          {wod?.strength?.title && (
            <div className="text-xs text-zinc-500 mt-1">
              Part 1: {wod.strength.title}
              {wod.strength.scoreHint ? ` • Score: ${wod.strength.scoreHint}` : ''}
            </div>
          )}
        </div>
      </div>

      {canRecord ? (
  <form onSubmit={addScore} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Athlete name</label>
            <input
              value={athlete}
              onChange={(e) => setAthlete(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              placeholder="π.χ. Giannis"
            />
          </div>
          <div>
            <label className="block text-sm mb-1 text-zinc-300">Team (optional)</label>
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              placeholder="π.χ. Red"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1 text-zinc-300">RX/Scaled</label>
            <select
              value={rxScaled}
              onChange={(e) => setRxScaled(e.target.value as 'RX' | 'Scaled')}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
            >
              <option>RX</option>
              <option>Scaled</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1 text-zinc-300">Score (Main WOD)</label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
              placeholder="For Time: mm:ss  •  AMRAP: rounds+reps (π.χ. 7+12)"
            />
          </div>
        </div>

        <button className="px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm">
  Submit
</button>
      </form>
) : (
    <div className="mt-4 p-3 border border-zinc-800 bg-zinc-900 rounded text-sm text-zinc-300">
    Score recording for the Main WOD is <span className="font-semibold">disabled</span> for {fmt(date)}.
  </div>
)}
      <h2 className="text-lg font-semibold mt-6 mb-2">Leaderboard</h2>
      <div className="border border-zinc-800 rounded">
        {sorted.length === 0 ? (
          <div className="p-3 text-sm text-zinc-400">No scores for {fmt(date)}.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {sorted.map((s, i) => (
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

      <p className="text-xs text-zinc-400 mt-2">* Demo: localStorage ανά ημερομηνία.</p>
    </section>
  );
}
