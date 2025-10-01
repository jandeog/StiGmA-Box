// app/schedule/edit/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Level = 'novice' | 'advanced' | 'all';

export type SlotDef = {
  time: string;           // "07:00"
  mainCap: number;        // e.g. 12
  waitCap: number;        // e.g. 2
  level: Level;           // novice | advanced | all
  label?: string;         // free text e.g. "competitive"
};

const keyScheduleTemplate = 'schedule_template';

// Default weekday template
const DEFAULT_TEMPLATE: SlotDef[] = [
  { time: '07:00', mainCap: 12, waitCap: 2, level: 'all' },
  { time: '08:30', mainCap: 12, waitCap: 2, level: 'all' },
  { time: '09:30', mainCap: 12, waitCap: 2, level: 'all' },
  { time: '10:30', mainCap: 12, waitCap: 2, level: 'all' },
  { time: '18:00', mainCap: 12, waitCap: 2, level: 'advanced', label: 'competitive' },
  { time: '19:00', mainCap: 12, waitCap: 2, level: 'all' },
  { time: '20:00', mainCap: 12, waitCap: 2, level: 'all' },
  { time: '21:00', mainCap: 12, waitCap: 2, level: 'all' },
];

export default function EditSchedulePage() {
  const [slots, setSlots] = useState<SlotDef[]>([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const raw = localStorage.getItem(keyScheduleTemplate);
    setSlots(raw ? (JSON.parse(raw) as SlotDef[]) : DEFAULT_TEMPLATE);
  }, []);

  const sortedSlots = useMemo(() => {
    // sort by time "HH:MM"
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(n => parseInt(n, 10));
      return h * 60 + m;
    };
    return [...slots].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  }, [slots]);

  const save = () => {
    // validation: unique times, valid caps
    const seen = new Set<string>();
    for (const s of slots) {
      if (!/^\d{2}:\d{2}$/.test(s.time)) {
        setMsg(`⚠️ Invalid time format: ${s.time} (use HH:MM)`);
        setTimeout(() => setMsg(''), 1800);
        return;
      }
      if (seen.has(s.time)) {
        setMsg(`⚠️ Duplicate time: ${s.time}`);
        setTimeout(() => setMsg(''), 1800);
        return;
      }
      seen.add(s.time);
      if (!(s.mainCap >= 0 && s.waitCap >= 0)) {
        setMsg('⚠️ Capacities must be ≥ 0');
        setTimeout(() => setMsg(''), 1800);
        return;
      }
    }
    localStorage.setItem(keyScheduleTemplate, JSON.stringify(sortedSlots));
    setMsg('✅ Saved schedule');
    setTimeout(() => setMsg(''), 1600);
  };

  const addSlot = () => {
    setSlots(s => [
      ...s,
      { time: '12:00', mainCap: 12, waitCap: 2, level: 'all' },
    ]);
  };

  const removeSlot = (time: string) => {
    setSlots(s => s.filter(x => x.time !== time));
  };

  const updateSlot = (time: string, patch: Partial<SlotDef>) => {
    setSlots(s => s.map(x => (x.time === time ? { ...x, ...patch } : x)));
  };

  return (
    <section className="max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Change Schedule</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/schedule"
            className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
          >
            Back to Schedule
          </Link>
          <button
            onClick={save}
            className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
          >
            Save
          </button>
        </div>
      </div>

      <p className="text-sm text-zinc-400 mb-3">
        Weekday template (Mon–Fri). Edit times, capacities, level or add a custom label.
      </p>

      <div className="space-y-2">
        {sortedSlots.map((s) => (
          <div key={s.time} className="border border-zinc-800 bg-zinc-900 rounded p-3">
            <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
              {/* Time */}
              <div className="sm:col-span-1">
                <label className="block text-xs text-zinc-400 mb-1">Time</label>
                <input
                  value={s.time}
                  onChange={(e) => updateSlot(s.time, { time: e.target.value })}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                  placeholder="HH:MM"
                />
              </div>

              {/* Main Cap */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Main cap</label>
                <input
                  inputMode="numeric"
                  value={String(s.mainCap)}
                  onChange={(e) => updateSlot(s.time, { mainCap: Number(e.target.value || 0) })}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                />
              </div>

              {/* Waitlist Cap */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Waitlist</label>
                <input
                  inputMode="numeric"
                  value={String(s.waitCap)}
                  onChange={(e) => updateSlot(s.time, { waitCap: Number(e.target.value || 0) })}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                />
              </div>

              {/* Level */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Level</label>
                <select
                  value={s.level}
                  onChange={(e) => updateSlot(s.time, { level: e.target.value as Level })}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                >
                  <option value="all">All Levels</option>
                  <option value="novice">Novice</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              {/* Label */}
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Label (optional)</label>
                <input
                  value={s.label || ''}
                  onChange={(e) => updateSlot(s.time, { label: e.target.value || undefined })}
                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
                  placeholder="e.g. competitive, weightlifting..."
                />
              </div>

              {/* Actions */}
              <div className="sm:col-span-6 flex items-center gap-2 justify-end">
                <button
                  onClick={() => removeSlot(s.time)}
                  className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={addSlot}
          className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
        >
          + Add slot
        </button>
        {msg && <div className="text-sm text-zinc-300">{msg}</div>}
      </div>
    </section>
  );
}
