'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

type HourRow = {
  day_of_week: number;    // 0..6
  slot_index: number;     // 1..12
  slot_time: string;      // HH:MM:SS
  slot_title: string;
  cap_main: number;
  cap_wait: number;
  active: boolean;
};

const MAX_SLOTS = 12;
const CAP_MAIN_DEFAULT = 14;
const CAP_WAIT_DEFAULT = 2;

function padHM(v: string) {
  // accept "07:00" or "7:00" → "07:00"
  const [h, m] = v.split(':').map((x) => x.trim());
  return `${String(h).padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
}

export default function ScheduleEditPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [role, setRole] = useState<'coach' | 'athlete' | null>(null);
  const [dow, setDow] = useState<number>(1); // default Monday
  const [rows, setRows] = useState<Array<HourRow>>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [coachId, setCoachId] = useState('');
  const [msg, setMsg] = useState('');

  // auth / guard
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
      let r: 'coach' | 'athlete' | null = (u?.user_metadata as any)?.role ?? null;
      if (!r) {
        try {
          const raw = localStorage.getItem('auth:user');
          const parsed = raw ? JSON.parse(raw) : null;
          r = parsed?.role ?? null;
        } catch {}
      }
      setRole(r);
    })();
  }, [supabase]);

  // load class_hours for selected day
  async function loadDayHours(day: number) {
    const { data, error } = await supabase
      .from('class_hours')
      .select('day_of_week,slot_index,slot_time,slot_title,cap_main,cap_wait,active')
      .eq('day_of_week', day)
      .order('slot_index', { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    // ensure we have 1..12 slots (fill missing)
    const byIndex: Record<number, HourRow> = {};
    (data || []).forEach((r) => {
      byIndex[r.slot_index] = r as HourRow;
    });

    const full: HourRow[] = [];
    for (let i = 1; i <= MAX_SLOTS; i++) {
      const r = byIndex[i];
      if (r) {
        full.push(r);
      } else {
        full.push({
          day_of_week: day,
          slot_index: i,
          slot_time: '00:00:00',
          slot_title: '',
          cap_main: CAP_MAIN_DEFAULT,
          cap_wait: CAP_WAIT_DEFAULT,
          active: false,
        });
      }
    }
    setRows(full);
  }

  useEffect(() => {
    loadDayHours(dow);
  }, [dow]);

  if (role !== 'coach') {
    return (
      <section className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-3">Change Schedule</h1>
        <div className="p-3 border border-red-700 bg-red-900/20 rounded text-sm text-red-300">
          Only coaches can edit the schedule.
        </div>
        <div className="mt-4">
          <Link href="/schedule" className="text-sm underline text-zinc-300">
            Back to schedule
          </Link>
        </div>
      </section>
    );
  }

  async function saveDay() {
    // upsert all 12 slots for the selected day
    const payload = rows.map((r) => ({
      day_of_week: r.day_of_week,
      slot_index: r.slot_index,
      slot_time: r.slot_time, // HH:MM:SS
      slot_title: r.slot_title || 'Class',
      cap_main: r.cap_main || CAP_MAIN_DEFAULT,
      cap_wait: r.cap_wait || CAP_WAIT_DEFAULT,
      active: !!r.active,
    }));

    const { error } = await supabase.from('class_hours').upsert(payload, {
      onConflict: 'day_of_week,slot_index',
    });

    if (error) {
      console.error(error);
      setMsg('❌ Failed to save');
      setTimeout(() => setMsg(''), 1800);
      return;
    }
    setMsg('✅ Saved');
    setTimeout(() => setMsg(''), 1200);
    // reload to normalize / ensure order
    loadDayHours(dow);
  }

  async function applyRange() {
    if (!fromDate || !toDate) {
      setMsg('⚠️ Select from & to dates');
      setTimeout(() => setMsg(''), 1800);
      return;
    }
    const { error } = await supabase.rpc('apply_hours_to_range', {
      from_date: fromDate,
      to_date: toDate,
      coach: coachId || null,
    });
    if (error) {
      console.error(error);
      setMsg('❌ Failed to apply to DB');
      setTimeout(() => setMsg(''), 2000);
      return;
    }
    setMsg('✅ Applied to DB');
    setTimeout(() => setMsg(''), 1400);
  }

  function setRow(i: number, patch: Partial<HourRow>) {
    setRows((prev) =>
      prev.map((r) => (r.slot_index === i ? { ...r, ...patch } : r))
    );
  }

  return (
    <section className="max-w-4xl mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Change Schedule</h1>
        <Link href="/schedule" className="text-sm underline text-zinc-300">
          Back
        </Link>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm text-zinc-400">Day of week:</label>
        <select
          value={dow}
          onChange={(e) => setDow(Number(e.target.value))}
          className="px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
        >
          <option value={0}>Sunday</option>
          <option value={1}>Monday</option>
          <option value={2}>Tuesday</option>
          <option value={3}>Wednesday</option>
          <option value={4}>Thursday</option>
          <option value={5}>Friday</option>
          <option value={6}>Saturday</option>
        </select>

        <button
          onClick={saveDay}
          className="ml-auto px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
        >
          Save day
        </button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="grid grid-cols-12 gap-2 p-2 text-xs text-zinc-400 border-b border-zinc-800">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Active</div>
          <div className="col-span-2">Time (HH:MM)</div>
          <div className="col-span-3">Title</div>
          <div className="col-span-2">Main cap</div>
          <div className="col-span-2">Wait cap</div>
        </div>

        {rows.map((r) => (
          <div
            key={r.slot_index}
            className="grid grid-cols-12 gap-2 p-2 border-b border-zinc-900 items-center"
          >
            <div className="col-span-1 text-xs text-zinc-400">#{r.slot_index}</div>
            <div className="col-span-2">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) => setRow(r.slot_index, { active: e.target.checked })}
                />
                active
              </label>
            </div>
            <div className="col-span-2">
              <input
                placeholder="07:00"
                value={r.slot_time ? String(r.slot_time).slice(0,5) : ''}
                onChange={(e) =>
                  setRow(r.slot_index, { slot_time: padHM(e.target.value) + ':00' })
                }
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              />
            </div>
            <div className="col-span-3">
              <input
                placeholder="Class"
                value={r.slot_title}
                onChange={(e) => setRow(r.slot_index, { slot_title: e.target.value })}
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min={0}
                value={r.cap_main}
                onChange={(e) => setRow(r.slot_index, { cap_main: Number(e.target.value || CAP_MAIN_DEFAULT) })}
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              />
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min={0}
                value={r.cap_wait}
                onChange={(e) => setRow(r.slot_index, { cap_wait: Number(e.target.value || CAP_WAIT_DEFAULT) })}
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2 p-4 rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="text-sm text-zinc-300 font-medium">Apply hours to a date range</div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
          />
          <input
            placeholder="Coach UUID (optional)"
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
          />
          <button
            onClick={applyRange}
            className="px-3 py-2 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
          >
            Apply to DB
          </button>
        </div>
        <div className="text-xs text-zinc-500">
          Θα δημιουργήσει / αντικαταστήσει τις ημέρες στο <code>schedule_day</code> βάσει των <code>class_hours</code>. Default capacities: Main 14, WL 2.
        </div>
        {msg && <div className="text-sm text-zinc-300">{msg}</div>}
      </div>
    </section>
  );
}
