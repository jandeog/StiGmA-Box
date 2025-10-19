'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type TemplateSlot = {
  time: string;            // "HH:MM"
  title?: 'Class' | 'Competitive' | 'Teams';
  capacityMain?: number;   // default 14
  capacityWait?: number;   // default 2
  enabled?: boolean;       // false → ignore
};

type WeekTemplate = {
  weekdays: TemplateSlot[];   // Mon..Fri
  saturday: TemplateSlot[];
  sunday: TemplateSlot[];     // usually empty
};

type Slot = {
  id: string;
  time: string;
  title?: string;
  capacityMain: number;
  capacityWait: number;
  participantsMain: string[];
  participantsWait: string[];
};

type DayRecord = { date: string; slots: Slot[] };
type DaysStore = Record<string, DayRecord>;

const STORAGE_TEMPLATE = 'schedule:template';
const STORAGE_DAYS = 'schedule:days';
const CAP_MAIN_DEFAULT = 14;
const CAP_WAIT_DEFAULT = 2;

// Εφαρμογή “from now on” για πόσες μέρες μπροστά (6 μήνες ~ 180 μέρες)
const APPLY_HORIZON_DAYS = 180;

const DEFAULT_TEMPLATE: WeekTemplate = {
  weekdays: [
    { time: '07:00', title: 'Class' }, { time: '08:30', title: 'Class' }, { time: '09:30', title: 'Class' },
    { time: '10:30', title: 'Class' }, { time: '17:00', title: 'Class' }, { time: '18:00', title: 'Competitive' },
    { time: '19:00', title: 'Class' }, { time: '20:00', title: 'Class' }, { time: '21:00', title: 'Class' }
  ],
  // Σάββατο: πάντα 2 classes με Teams, εκτός αν αλλάξει το template ο coach
  saturday: [{ time: '10:00', title: 'Teams' }, { time: '18:00', title: 'Teams' }],
  sunday: []
};

function loadTemplate(): WeekTemplate {
  try {
    const raw = localStorage.getItem(STORAGE_TEMPLATE);
    if (!raw) return DEFAULT_TEMPLATE;
    return JSON.parse(raw) as WeekTemplate;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}
function saveTemplate(tpl: WeekTemplate) {
  localStorage.setItem(STORAGE_TEMPLATE, JSON.stringify(tpl));
}
function loadDays(): DaysStore {
  try {
    const raw = localStorage.getItem(STORAGE_DAYS);
    return raw ? (JSON.parse(raw) as DaysStore) : {};
  } catch {
    return {};
  }
}
function saveDays(days: DaysStore) {
  localStorage.setItem(STORAGE_DAYS, JSON.stringify(days));
}
function uid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
function padHM(v: string) {
  const [h, m] = v.split(':').map(s => s.trim());
  return `${String(h || '00').padStart(2, '0')}:${String(m || '00').padStart(2, '0')}`;
}
function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const y2 = dt.getFullYear();
  const m2 = String(dt.getMonth() + 1).padStart(2, '0');
  const d2 = String(dt.getDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
}
function eachDate(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromISO.split('-').map(Number);
  const [ty, tm, td] = toISO.split('-').map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function ScheduleEditPage() {
  const [tpl, setTpl] = useState<WeekTemplate>(DEFAULT_TEMPLATE);
  const [dow, setDow] = useState<number>(1); // 1=Mon ... 6=Sat, 0=Sun
  const [applyMode, setApplyMode] = useState<'one' | 'weekly' | 'weekdays'>('one');
  const [specificDate, setSpecificDate] = useState<string>(isoToday());
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setTpl(loadTemplate());
  }, []);

  const listByDow = useMemo<TemplateSlot[]>(() => {
    if (dow === 0) return tpl.sunday;
    if (dow === 6) return tpl.saturday;
    return tpl.weekdays;
  }, [tpl, dow]);

  function setList(upd: TemplateSlot[]) {
    if (dow === 0) setTpl(prev => ({ ...prev, sunday: upd }));
    else if (dow === 6) setTpl(prev => ({ ...prev, saturday: upd }));
    else setTpl(prev => ({ ...prev, weekdays: upd }));
  }

  function addSlot() {
    const newSlot: TemplateSlot = {
      time: '07:00',
      title: (dow === 6 ? 'Teams' : 'Class') as 'Class' | 'Competitive' | 'Teams',
      capacityMain: CAP_MAIN_DEFAULT,
      capacityWait: CAP_WAIT_DEFAULT,
      enabled: true,
    };
    const upd: TemplateSlot[] = [...listByDow, newSlot];
    setList(upd);
  }

  function updateSlot(index: number, patch: Partial<TemplateSlot>) {
    const upd = listByDow.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setList(upd);
  }

  function removeSlot(index: number) {
    const upd = listByDow.filter((_, i) => i !== index);
    setList(upd);
  }

  function onSaveTemplate() {
    // sanitize
   const sanitize = (arr: TemplateSlot[]) =>
    arr
      .map((s): TemplateSlot => ({
        time: padHM(s.time || '00:00'),
        title: (s.title ?? ((dow === 6 ? 'Teams' : 'Class') as 'Class' | 'Competitive' | 'Teams')),
        capacityMain: Number(s.capacityMain ?? CAP_MAIN_DEFAULT),
        capacityWait: Number(s.capacityWait ?? CAP_WAIT_DEFAULT),
        enabled: s.enabled !== false,
      }))
        .sort((a, b) => a.time.localeCompare(b.time));

    const clean: WeekTemplate = {
      weekdays: sanitize(tpl.weekdays),
      saturday: sanitize(tpl.saturday),
      sunday: sanitize(tpl.sunday)
    };
    setTpl(clean);
    saveTemplate(clean);
    setMsg('✅ Template saved');
    setTimeout(() => setMsg(''), 1400);
  }

  // Μετατρέπει template slots σε DayRecord.slots (local storage σχήμα)
  function buildDaySlots(from: TemplateSlot[]): Slot[] {
    return from
      .filter(s => s.enabled !== false)
      .map(s => ({
        id: uid(),
        time: padHM(s.time || '00:00'),
        title: (s.title || 'Class') as string,
        capacityMain: Number(s.capacityMain ?? CAP_MAIN_DEFAULT),
        capacityWait: Number(s.capacityWait ?? CAP_WAIT_DEFAULT),
        participantsMain: [],
        participantsWait: []
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  function applyNow() {
    const days = loadDays();

    if (applyMode === 'one') {
      if (!specificDate) {
        setMsg('⚠️ Pick a date');
        setTimeout(() => setMsg(''), 1500);
        return;
      }
      const d = new Date(specificDate + 'T00:00:00');
      const curDow = d.getDay();
      const base = curDow === 0 ? tpl.sunday : curDow === 6 ? tpl.saturday : tpl.weekdays;
      const slots = buildDaySlots(base);
      (days as DaysStore)[specificDate] = { date: specificDate, slots };
    }

    if (applyMode === 'weekly') {
      // για αυτό το dow, κάθε εβδομάδα από σήμερα μέχρι το horizon
      const today = isoToday();
      const end = addDays(today, APPLY_HORIZON_DAYS);
      const all = eachDate(today, end);
      const base = dow === 0 ? tpl.sunday : dow === 6 ? tpl.saturday : tpl.weekdays;
      const slots = buildDaySlots(base);
      for (const date of all) {
        const d = new Date(date + 'T00:00:00');
        if (d.getDay() === dow) {
          (days as DaysStore)[date] = { date, slots: buildDaySlots(base) }; // νέα ids ανά μέρα
        }
      }
    }

    if (applyMode === 'weekdays') {
      // Mon-Fri από σήμερα μέχρι horizon, κάθε μέρα σύμφωνα με το αντίστοιχο template της ημέρας
      const today = isoToday();
      const end = addDays(today, APPLY_HORIZON_DAYS);
      const all = eachDate(today, end);
      for (const date of all) {
        const d = new Date(date + 'T00:00:00');
        const dow = d.getDay();
        if (dow >= 1 && dow <= 5) {
          const base = tpl.weekdays;
          (days as DaysStore)[date] = { date, slots: buildDaySlots(base) };
        }
      }
    }

    saveDays(days);
    setMsg('✅ Applied');
    setTimeout(() => setMsg(''), 1400);
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
          onClick={onSaveTemplate}
          className="ml-auto px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
        >
          Save template
        </button>
      </div>

      {/* Slots table/editor */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="grid grid-cols-12 gap-2 p-2 text-xs text-zinc-400 border-b border-zinc-800">
          <div className="col-span-1">#</div>
          <div className="col-span-2">Active</div>
          <div className="col-span-2">Time (HH:MM)</div>
          <div className="col-span-3">Title</div>
          <div className="col-span-2">Main cap</div>
          <div className="col-span-2">Wait cap</div>
        </div>

        {listByDow.map((s, idx) => (
          <div
            key={idx}
            className="grid grid-cols-12 gap-2 p-2 border-b border-zinc-900 items-center"
          >
            <div className="col-span-1 text-xs text-zinc-400">#{idx + 1}</div>
            <div className="col-span-2">
              <label className="inline-flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={s.enabled !== false}
                  onChange={(e) => updateSlot(idx, { enabled: e.target.checked })}
                />
                active
              </label>
            </div>
            <div className="col-span-2">
              <input
                placeholder="07:00"
                value={s.time}
                onChange={(e) => updateSlot(idx, { time: padHM(e.target.value) })}
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              />
            </div>
            <div className="col-span-3">
              {/* Dropdown Title */}
              <select
                value={s.title ?? (dow === 6 ? 'Teams' : 'Class')}
                onChange={(e) => updateSlot(idx, { title: e.target.value as 'Class' | 'Competitive' | 'Teams' })}
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              >
                <option value="Class">Class</option>
                <option value="Competitive">Competitive</option>
                <option value="Teams">Teams</option>
              </select>
            </div>
            <div className="col-span-2">
              <input
                type="number"
                min={0}
                value={Number(s.capacityMain ?? CAP_MAIN_DEFAULT)}
                onChange={(e) => updateSlot(idx, { capacityMain: Number(e.target.value || CAP_MAIN_DEFAULT) })}
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              />
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={Number(s.capacityWait ?? CAP_WAIT_DEFAULT)}
                  onChange={(e) => updateSlot(idx, { capacityWait: Number(e.target.value || CAP_WAIT_DEFAULT) })}
                  className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
                />
                <button
                  onClick={() => removeSlot(idx)}
                  className="px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
                  title="Remove slot"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="p-2">
          <button
            onClick={addSlot}
            className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
          >
            + Add slot
          </button>
        </div>
      </div>

      {/* Apply options */}
      <div className="mt-6 flex flex-col gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="text-sm text-zinc-300 font-medium">Apply template</div>

        <div className="flex flex-col gap-2 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="applyMode"
              value="one"
              checked={applyMode === 'one'}
              onChange={() => setApplyMode('one')}
            />
            For this specific day (only one day)
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="applyMode"
              value="weekly"
              checked={applyMode === 'weekly'}
              onChange={() => setApplyMode('weekly')}
            />
            For this day every week from now on
          </label>

          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="applyMode"
              value="weekdays"
              checked={applyMode === 'weekdays'}
              onChange={() => setApplyMode('weekdays')}
            />
            For all week days (Mon–Fri) from now on
          </label>
        </div>

        {applyMode === 'one' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={specificDate}
              onChange={(e) => setSpecificDate(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={applyNow}
            className="px-3 py-2 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
          >
            Apply
          </button>
          {msg && <div className="text-sm text-zinc-300">{msg}</div>}
        </div>

        <div className="text-xs text-zinc-500">
          • Saturdays default to two <span className="text-zinc-300">Teams</span> classes unless you update this template. <br />
          • “From now on” applies for ~{APPLY_HORIZON_DAYS} days ahead (change <code>APPLY_HORIZON_DAYS</code> if θες μεγαλύτερο ορίζοντα).
        </div>
      </div>
    </section>
  );
}
