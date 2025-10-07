// app/display/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import DateStepper from '@/components/DateStepper';


type ScoringType = 'for_time' | 'amrap';
type StrengthPart = { title: string; description: string; scoreHint: string };
type WOD = { title: string; description: string; scoring: ScoringType; timeCap: string; date: string; strength?: StrengthPart };
type Score = { id: string; athlete: string; team?: string; rxScaled: 'RX'|'Scaled'; value: string; date: string };

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
};
const wodKey = (d: string) => `wod:${d}`;
const scoresKey = (d: string) => `scores:${d}`;

export default function DisplayPage() {
  const [date, setDate] = useState(todayStr());
  const [wod, setWod] = useState<WOD | null>(null);
  const [scores, setScores] = useState<Score[]>([]);

  const refresh = useCallback(() => {
    const w = localStorage.getItem(wodKey(date));
    setWod(w ? (JSON.parse(w) as WOD) : null);
    const s = localStorage.getItem(scoresKey(date));
    setScores(s ? (JSON.parse(s) as Score[]) : []);
  }, [date]);

 useEffect(() => {
    // τρέξε άμεσα και μετά κάθε 2"
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const sorted = useMemo(() => {
    if (!wod) return scores;
    const s = [...scores];
    if (wod.scoring === 'for_time') {
      const toSec = (v: string) => {
        const parts = v.split(':').map((n) => parseInt(n || '0', 10));
        if (parts.length === 1) return parts[0] || 0;
        return (parts[0] || 0) * 60 + (parts[1] || 0);
      };
      return s.sort((a, b) => toSec(a.value) - toSec(b.value));
    }
    // AMRAP
    const toReps = (v: string) => {
      if (v.includes('+')) {
        const [r, reps] = v.split('+').map((x) => parseInt(x || '0', 10));
        return r * 1000 + (reps || 0);
      }
      return parseInt(v || '0', 10);
    };
    return s.sort((a, b) => toReps(b.value) - toReps(a.value));
  }, [scores, wod]);

  return (
    <section className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">TV Display</h1>
        <div className="ml-auto flex items-center gap-2"></div>
<DateStepper value={date} onChange={setDate} />
        <button
          onClick={refresh}
          className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Strength / Skills */}
      <div className="border border-zinc-800 rounded p-4 bg-zinc-900 mb-3">
        <div className="text-sm text-zinc-400">{fmt(date)}</div>
        <div className="text-xs text-zinc-400">Part 1 — Strength / Skills</div>
        <div className="text-xl font-bold">{wod?.strength?.title || '—'}</div>
        <div className="text-sm text-zinc-300 whitespace-pre-wrap mt-1">
          {wod?.strength?.description || '—'}
        </div>
        {wod?.strength?.scoreHint && (
          <div className="text-sm text-zinc-400 mt-1">Score: {wod.strength.scoreHint}</div>
        )}
      </div>

      {/* Main WOD */}
      <div className="border border-zinc-800 rounded p-4 bg-zinc-900 mb-4">
        <div className="text-xs text-zinc-400">Main WOD</div>
        <div className="text-2xl font-extrabold">{wod?.title || '— WOD not set —'}</div>
        {wod && (
          <div className="text-sm text-zinc-400 mt-1">
            Scoring: {wod.scoring} {wod.timeCap ? `• Time cap: ${wod.timeCap}` : ''}
          </div>
          
        )}
        <div className="text-sm text-zinc-300 whitespace-pre-wrap mt-2">
  {wod?.description || '—'}
</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.length === 0 ? (
          <div className="p-4 text-sm text-zinc-400 border border-zinc-800 rounded">No scores yet.</div>
        ) : (
          sorted.map((s, i) => (
            <div key={s.id} className="border border-zinc-800 rounded p-4 bg-zinc-900 flex items-center">
              <div className="w-10 text-zinc-400 text-lg">#{i + 1}</div>
              <div className="flex-1">
                <div className="font-semibold text-lg">{s.athlete}</div>
                <div className="text-xs text-zinc-400">
                  {s.team ? `${s.team} • ` : ''}{s.rxScaled}
                </div>
              </div>
              <div className="text-xl font-bold">{s.value}</div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-zinc-500 mt-4">
        * Demo localStorage: ενημέρωση κάθε 2″. (Για real-time θα βάλουμε Socket.IO.)
      </p>
    </section>
  );
}
