// app/schedule/page.tsx
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import DateStepper from '@/components/DateStepper';

/* ========================= Types ========================= */

type SlotConfig = {
  id: string;
  time: string;           // "HH:MM"
  capacityMain: number;   // διαθέσιμες θέσεις
  capacityWait: number;   // θέσεις αναμονής (WL)
  label?: string;         // "competitive" | "novice" | "advanced" | custom
};

type DayConfig = {
  slots: SlotConfig[];
};

type ScheduleConfig = {
  // 0=Sunday ... 6=Saturday
  byDow: Record<number, DayConfig>;
};

// Per-date overrides: YYYY-MM-DD -> slots for that exact date
type ScheduleOverrides = Record<string, SlotConfig[]>;

type DayBookings = Record<string, { main: string[]; wait: string[] }>;

type Session = { role: 'coach' | 'athlete'; athleteId?: string };

/* ===================== Helpers ===================== */

const WEEKDAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const pad = (n: number) => String(n).padStart(2, '0');
const dateToLocalISO = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => dateToLocalISO(new Date());
const addDaysISO = (iso: string, days: number) => {
  const [y, m, dd] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, dd);
  dt.setDate(dt.getDate() + days);
  return dateToLocalISO(dt);
};
const tomorrowISO = () => addDaysISO(todayISO(), 1);

const keyConfig = 'schedule:config';
const keyOverrides = 'schedule:overrides';
const keyBookings = (date: string) => `bookings:${date}`;

const isPresetLabel = (label: string) =>
  ['competitive', 'novice', 'advanced', ''].includes(label);

const selectValueFromLabel = (label?: string) => {
  if (!label) return '';
  return isPresetLabel(label) ? label : 'custom';
};

const cloneSlot = (s: SlotConfig): SlotConfig => ({ ...s, id: crypto.randomUUID() });

const parseHM = (time: string) => {
  const [h, m] = time.split(':').map((x) => parseInt(x, 10));
  return { h: h || 0, m: m || 0 };
};

const toDateAt = (isoDate: string, time: string) => {
  const { h, m } = parseHM(time);
  const d = new Date(isoDate + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  return d;
};

/* ===================== Defaults ===================== */

const defaultWeekdaySlots = (): SlotConfig[] => [
  { id: crypto.randomUUID(), time: '07:00', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '08:30', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '09:30', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '10:30', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '17:00', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '18:00', capacityMain: 12, capacityWait: 2, label: 'competitive' },
  { id: crypto.randomUUID(), time: '19:00', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '20:00', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '21:00', capacityMain: 12, capacityWait: 2 },
];

const defaultSaturdaySlots = (): SlotConfig[] => [
  { id: crypto.randomUUID(), time: '10:00', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '18:00', capacityMain: 12, capacityWait: 2 },
];

const defaultConfig = (): ScheduleConfig => ({
  byDow: {
    0: { slots: [] }, // Sunday
    1: { slots: defaultWeekdaySlots() },                     // Monday
    2: { slots: defaultWeekdaySlots().map(cloneSlot) },     // Tuesday
    3: { slots: defaultWeekdaySlots().map(cloneSlot) },     // Wednesday
    4: { slots: defaultWeekdaySlots().map(cloneSlot) },     // Thursday
    5: { slots: defaultWeekdaySlots().map(cloneSlot) },     // Friday
    6: { slots: defaultSaturdaySlots() },                   // Saturday
  },
});

function ensureSlotExists(slots: SlotConfig[], time: string): SlotConfig[] {
  return slots.some(s => s.time === time)
    ? slots
    : [...slots, { id: crypto.randomUUID(), time, capacityMain: 12, capacityWait: 2, label: '' }];
}

function migrateConfig(c: ScheduleConfig): ScheduleConfig {
  const next: ScheduleConfig = { byDow: { ...c.byDow } };
  // Ensure 17:00 exists on Mon–Fri (1..5)
  for (const d of [1, 2, 3, 4, 5]) {
    const day = next.byDow[d] ?? { slots: [] };
    next.byDow[d] = { slots: ensureSlotExists(day.slots, '17:00') };
  }
  return next;
}

/* ===================== Page ===================== */

export default function SchedulePage() {
  const [date, setDate] = useState<string>(todayISO());
  const dow = useMemo(() => new Date(date + 'T00:00:00').getDay(), [date]);
  const weekdayName = WEEKDAYS_FULL[dow];

  // session (για athleteId)
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth:user');
      setSession(raw ? (JSON.parse(raw) as Session) : null);
    } catch {}
  }, []);
  const myAthleteId = session?.athleteId || null;

  // base templates (per-dow) & overrides
  const [config, setConfig] = useState<ScheduleConfig>(defaultConfig());
  const [overrides, setOverrides] = useState<ScheduleOverrides>({});

  // day bookings (per selected date)
  const [dayData, setDayData] = useState<DayBookings>({});

  // editor state
  const [editing, setEditing] = useState<boolean>(false);
  const [draftSlots, setDraftSlots] = useState<SlotConfig[]>([]);
  const [applyScope, setApplyScope] = useState<'date' | 'weekday' | 'weekdays'>('weekday');

  // load config/overrides on mount
  useEffect(() => {
    const rawC = localStorage.getItem(keyConfig);
    if (rawC) {
      try {
        const parsed = JSON.parse(rawC) as ScheduleConfig;
        const migrated = migrateConfig(parsed);
        setConfig(migrated);
        if (JSON.stringify(migrated) !== rawC) {
          localStorage.setItem(keyConfig, JSON.stringify(migrated));
        }
      } catch {}
    }
    const rawO = localStorage.getItem(keyOverrides);
    if (rawO) {
      try {
        setOverrides(JSON.parse(rawO) as ScheduleOverrides);
      } catch {}
    }
  }, []);

  // load bookings for selected date
  useEffect(() => {
    const raw = localStorage.getItem(keyBookings(date));
    setDayData(raw ? (JSON.parse(raw) as DayBookings) : {});
  }, [date]);

  // visible slots: override wins
  const visibleSlots: SlotConfig[] = useMemo(() => {
    const ov = overrides[date];
    if (ov) return ov.slice().sort((a, b) => a.time.localeCompare(b.time));
    const base = config.byDow[dow]?.slots ?? [];
    return base.slice().sort((a, b) => a.time.localeCompare(b.time));
  }, [overrides, date, config, dow]);

  // when starting editor, prefill
  useEffect(() => {
    if (!editing) return;
    const ov = overrides[date];
    if (ov) {
      setDraftSlots(ov.map((s) => ({ ...s })));
      setApplyScope('date');
    } else {
      const base = config.byDow[dow]?.slots ?? [];
      setDraftSlots(base.map((s) => ({ ...s })));
      setApplyScope('weekday');
    }
  }, [editing, date, dow, config, overrides]);

  /* ---------------- Booking helpers ---------------- */

  const countsFor = useCallback((time: string) => {
    const rec = dayData[time];
    return { main: rec?.main?.length || 0, wait: rec?.wait?.length || 0 };
  }, [dayData]);

  const availabilityFor = useCallback((time: string, capMain: number, capWait: number) => {
    const { main, wait } = countsFor(time);
    const mainLeft = Math.max(capMain - main, 0);
    const waitLeft = Math.max(capWait - wait, 0);
    const hasAvailability = main < capMain || (main >= capMain && wait < capWait);
    const isFullyBooked = main >= capMain && wait >= capWait;
    return { main, wait, mainLeft, waitLeft, hasAvailability, isFullyBooked };
  }, [countsFor]);

  // rules: only today or tomorrow
  const now = new Date();
  const isToday = date === todayISO();
  const isTomorrow = date === tomorrowISO();
  const dateAllowed = isToday || isTomorrow;

  // one booking per selected day
  const myBookingTime: string | null = useMemo(() => {
    if (!myAthleteId) return null;
    for (const [t, rec] of Object.entries(dayData)) {
      if (rec.main?.includes(myAthleteId) || rec.wait?.includes(myAthleteId)) return t;
    }
    return null;
  }, [dayData, myAthleteId]);

  const canBookThisSlot = (slot: SlotConfig) => {
    if (!myAthleteId) return { ok: false, reason: 'Please login first.' };
    if (!dateAllowed) return { ok: false, reason: 'Booking is allowed only for today or tomorrow.' };

    const start = toDateAt(date, slot.time);

    // Unavailable for past or in-progress slots
    if (isToday && now >= start) return { ok: false, reason: 'This class has already started or finished.' };

    // Cut-off: must be >= 30 minutes before start
    if (isToday) {
      const diffMs = start.getTime() - now.getTime();
      if (diffMs < 30 * 60 * 1000) {
        return { ok: false, reason: 'Bookings close 30 minutes before start.' };
      }
    }

    // Single booking per day
    if (myBookingTime && myBookingTime !== slot.time) {
      return { ok: false, reason: `You already booked ${myBookingTime}. Cancel it to change.` };
    }

    const { hasAvailability } = availabilityFor(slot.time, slot.capacityMain, slot.capacityWait);
    if (!hasAvailability) return { ok: false, reason: 'Full (including waitlist).' };

    return { ok: true };
  };

  const saveBookings = (next: DayBookings) => {
    setDayData(next);
    localStorage.setItem(keyBookings(date), JSON.stringify(next));
  };

  const bookSlot = (slot: SlotConfig) => {
    if (!myAthleteId) return alert('Please login first.');
    const rule = canBookThisSlot(slot);
    if (!rule.ok) return alert(rule.reason);

    if (!confirm(`Confirm booking for ${date} at ${slot.time}?`)) return;

    const current = structuredClone(dayData) as DayBookings;
    const rec = current[slot.time] || { main: [], wait: [] };

    const { mainLeft, waitLeft } = availabilityFor(slot.time, slot.capacityMain, slot.capacityWait);

    // Avoid duplicates
    if (rec.main.includes(myAthleteId) || rec.wait.includes(myAthleteId)) {
      return alert('Already booked.');
    }

    if (mainLeft > 0) rec.main.push(myAthleteId);
    else if (waitLeft > 0) rec.wait.push(myAthleteId);
    else return alert('No availability.');

    current[slot.time] = rec;
    saveBookings(current);
  };

  const cancelSlot = (slot: SlotConfig) => {
    if (!myAthleteId) return;
    if (!confirm(`Cancel your booking for ${date} at ${slot.time}?`)) return;

    const current = structuredClone(dayData) as DayBookings;
    const rec = current[slot.time];
    if (!rec) return;

    const beforeMain = rec.main.length;
    rec.main = rec.main.filter((id) => id !== myAthleteId);
    const removedFromMain = beforeMain !== rec.main.length;

    if (!removedFromMain) {
      rec.wait = rec.wait.filter((id) => id !== myAthleteId);
    }

    current[slot.time] = rec;
    saveBookings(current);
  };

  const onToggleEditor = () => setEditing((v) => !v);

  /* ---------------- Editor helpers ---------------- */

  const setDraftValue = (id: string, patch: Partial<SlotConfig>) => {
    setDraftSlots((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addDraftSlot = () => {
    setDraftSlots((arr) => [
      ...arr,
      {
        id: crypto.randomUUID(),
        time: '12:00',
        capacityMain: 12,
        capacityWait: 2,
        label: '',
      },
    ]);
  };

  const removeDraftSlot = (id: string) =>
    setDraftSlots((arr) => arr.filter((s) => s.id !== id));

  const moveUp = (index: number) =>
    setDraftSlots((arr) => {
      if (index <= 0) return arr;
      const copy = [...arr];
      [copy[index - 1], copy[index]] = [copy[index], copy[index - 1]];
      return copy;
    });

  const moveDown = (index: number) =>
    setDraftSlots((arr) => {
      if (index >= arr.length - 1) return arr;
      const copy = [...arr];
      [copy[index + 1], copy[index]] = [copy[index], copy[index + 1]];
      return copy;
    });

  const saveDraft = () => {
    const norm = [...draftSlots].sort((a, b) => a.time.localeCompare(b.time));

    if (applyScope === 'weekday') {
      const next: ScheduleConfig = {
        byDow: {
          ...config.byDow,
          [dow]: { slots: norm },
        },
      };
      setConfig(next);
      localStorage.setItem(keyConfig, JSON.stringify(next));

      // Καθαρισμός override της ίδιας ημερομηνίας αν υπάρχει
      if (overrides[date]) {
        const { [date]: _omit, ...rest } = overrides;
        setOverrides(rest);
        localStorage.setItem(keyOverrides, JSON.stringify(rest));
      }
    } else if (applyScope === 'weekdays') {
      const next: ScheduleConfig = { byDow: { ...config.byDow } };
      for (const d of [1, 2, 3, 4, 5]) {
        next.byDow[d] = { slots: norm.map(s => ({ ...s })) };
      }
      setConfig(next);
      localStorage.setItem(keyConfig, JSON.stringify(next));

      if (overrides[date] && dow >= 1 && dow <= 5) {
        const { [date]: _omit, ...rest } = overrides;
        setOverrides(rest);
        localStorage.setItem(keyOverrides, JSON.stringify(rest));
      }
    } else {
      const nextOv: ScheduleOverrides = { ...overrides, [date]: norm };
      setOverrides(nextOv);
      localStorage.setItem(keyOverrides, JSON.stringify(nextOv));
    }

    setEditing(false);
  };

  const clearDateOverride = () => {
    if (!overrides[date]) return;
    const { [date]: _omit, ...rest } = overrides;
    setOverrides(rest);
    localStorage.setItem(keyOverrides, JSON.stringify(rest));
  };

  /* ---------------- Render ---------------- */

  // Μήνυμα κορυφής για περιορισμό ημέρας
  const dayMessage = !dateAllowed
    ? 'Bookings are only allowed for today or tomorrow.'
    : '';

  return (
    <section className="relative max-w-4xl h-auto min-h-0">
      {/* Header */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold">Schedule</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleEditor}
            className={`px-3 py-2 rounded border border-zinc-700 text-sm ${
              editing ? 'bg-zinc-800' : 'hover:bg-zinc-800'
            }`}
          >
            {editing ? 'Close editor' : 'Change schedule'}
          </button>
          {/* Απλό date input */}
<DateStepper
   value={date}
  onChange={setDate}
   className="text-sm"
 />
        </div>
      </div>

      {/* Info line */}
      <div className="text-sm text-zinc-400 mb-2">
        {WEEKDAYS_FULL[dow]} • {date}{' '}
        {overrides[date] ? (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-amber-700 text-amber-300">
            Override
          </span>
        ) : null}
        {!dateAllowed && (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300">
            Booking allowed only for today & tomorrow
          </span>
        )}
      </div>

      {/* Day message */}
      {dayMessage ? (
        <div className="p-3 mb-3 rounded border border-red-700 bg-red-900/20 text-sm text-red-300">
          {dayMessage}
        </div>
      ) : null}

      {/* Editor or Grid */}
      {editing ? (
        <Editor
          date={date}
          dow={dow}
          weekdayName={weekdayName}
          overrides={overrides}
          clearDateOverride={clearDateOverride}
          draftSlots={draftSlots}
          setDraftSlots={setDraftSlots}
          setDraftValue={setDraftValue}
          moveUp={moveUp}
          moveDown={moveDown}
          removeDraftSlot={removeDraftSlot}
          addDraftSlot={addDraftSlot}
          applyScope={applyScope}
          setApplyScope={setApplyScope}
          saveDraft={saveDraft}
        />
      ) : (
        <>
          {visibleSlots.length === 0 ? (
            <div className="p-3 border border-zinc-800 bg-zinc-900 rounded text-sm">
              {weekdayName === 'Sunday'
                ? 'Rest day. No classes scheduled. (You can add a date override if needed.)'
                : `No slots configured for ${weekdayName}. Click “Change schedule” to add slots.`}
            </div>
          ) : (
            <SlotsGrid
              slots={visibleSlots}
              date={date}
              dateAllowed={dateAllowed}
              myAthleteId={myAthleteId}
              myBookingTime={myBookingTime}
              countsFor={countsFor}
              availabilityFor={availabilityFor}
              canBookThisSlot={canBookThisSlot}
              bookSlot={bookSlot}
              cancelSlot={cancelSlot}
            />
          )}
        </>
      )}
    </section>
  );
}

/* ===================== Editor Subcomponent ===================== */

function Editor(props: {
  date: string;
  dow: number;
  weekdayName: string;
  overrides: ScheduleOverrides;
  clearDateOverride: () => void;
  draftSlots: SlotConfig[];
  setDraftSlots: React.Dispatch<React.SetStateAction<SlotConfig[]>>;
  setDraftValue: (id: string, patch: Partial<SlotConfig>) => void;
  moveUp: (i: number) => void;
  moveDown: (i: number) => void;
  removeDraftSlot: (id: string) => void;
  addDraftSlot: () => void;
  applyScope: 'date' | 'weekday' | 'weekdays';
  setApplyScope: (v: 'date' | 'weekday' | 'weekdays') => void;
  saveDraft: () => void;
}) {
  const {
    date, weekdayName, overrides, clearDateOverride,
    draftSlots, setDraftValue, moveUp, moveDown, removeDraftSlot, addDraftSlot,
    applyScope, setApplyScope, saveDraft,
  } = props;

  return (
    <div className="border border-zinc-800 bg-zinc-900 rounded p-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="font-semibold">
          Editing schedule for: {weekdayName} ({date})
        </div>
        <div className="text-xs text-zinc-400">
          Sunday is rest day by default; you can add slots only via date override.
        </div>
      </div>

      {/* Save scope */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="text-sm text-zinc-300">Apply change to:</div>
        <label className="text-sm flex items-center gap-2">
          <input
            type="radio"
            name="scope"
            value="weekday"
            checked={applyScope === 'weekday'}
            onChange={() => setApplyScope('weekday')}
          />
          Every <span className="font-medium">{weekdayName}</span>
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="radio"
            name="scope"
            value="weekdays"
            checked={applyScope === 'weekdays'}
            onChange={() => setApplyScope('weekdays')}
          />
          Every weekday (Mon–Fri)
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="radio"
            name="scope"
            value="date"
            checked={applyScope === 'date'}
            onChange={() => setApplyScope('date')}
          />
          This date only (<span className="font-mono">{date}</span>)
        </label>

        {overrides[date] ? (
          <button
            type="button"
            onClick={clearDateOverride}
            className="sm:ml-auto px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
            title="Remove override for this date"
          >
            Remove this date’s override
          </button>
        ) : null}
      </div>

      {/* Table of slots */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-300">
            <tr className="border-b border-zinc-800">
              <th className="py-2 text-left w-28">Time</th>
              <th className="py-2 text-left w-28">Capacity</th>
              <th className="py-2 text-left w-32">Waitlist</th>
              <th className="py-2 text-left">Label</th>
              <th className="py-2 text-right w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {draftSlots.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-center text-zinc-500">
                  No slots. Add one below.
                </td>
              </tr>
            ) : (
              draftSlots.map((s, idx) => (
                <tr key={s.id} className="border-b border-zinc-800">
                  <td className="py-2 pr-2">
                    <input
                      value={s.time}
                      onChange={(e) => setDraftValue(s.id, { time: e.target.value })}
                      className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                      placeholder="HH:MM"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      inputMode="numeric"
                      value={String(s.capacityMain)}
                      onChange={(e) =>
                        setDraftValue(s.id, {
                          capacityMain: Math.max(0, parseInt(e.target.value || '0', 10)),
                        })
                      }
                      className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                      placeholder="12"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      inputMode="numeric"
                      value={String(s.capacityWait)}
                      onChange={(e) =>
                        setDraftValue(s.id, {
                          capacityWait: Math.max(0, parseInt(e.target.value || '0', 10)),
                        })
                      }
                      className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                      placeholder="2"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={selectValueFromLabel(s.label)}
                        onChange={(e) => {
                          const sel = e.target.value;
                          if (sel === 'custom') {
                            setDraftValue(s.id, { label: 'custom' });
                          } else if (sel === '') {
                            setDraftValue(s.id, { label: '' });
                          } else {
                            setDraftValue(s.id, { label: sel }); // competitive / novice / advanced
                          }
                        }}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                      >
                        <option value="">—</option>
                        <option value="competitive">Competitive</option>
                        <option value="novice">Novice</option>
                        <option value="advanced">Advanced</option>
                        <option value="custom">Custom…</option>
                      </select>
                      {!isPresetLabel(s.label || '') && (
                        <input
                          value={s.label || ''}
                          onChange={(e) => setDraftValue(s.id, { label: e.target.value })}
                          className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                          placeholder="Custom label"
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveUp(idx)}
                        className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(idx)}
                        className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDraftSlot(s.id)}
                        className="px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/30"
                        title="Remove"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={addDraftSlot}
          className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
        >
          + Add slot
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => (document.activeElement as HTMLElement)?.blur()}
            className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveDraft}
            className="px-3 py-2 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
            title="Save schedule"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mt-2 text-xs text-zinc-500">
        Sunday is a rest day by default. You can still add slots for a specific Sunday by selecting
        <span className="mx-1 font-medium">“This date only”</span> and saving.
      </div>
    </div>
  );
}

/* ===================== Slots Grid (View) ===================== */

function SlotsGrid({
  slots,
  date,
  dateAllowed,
  myAthleteId,
  myBookingTime,
  countsFor,
  availabilityFor,
  canBookThisSlot,
  bookSlot,
  cancelSlot,
}: {
  slots: SlotConfig[];
  date: string;
  dateAllowed: boolean;
  myAthleteId: string | null;
  myBookingTime: string | null;
  countsFor: (time: string) => { main: number; wait: number };
  availabilityFor: (time: string, capMain: number, capWait: number) => {
    main: number;
    wait: number;
    mainLeft: number;
    waitLeft: number;
    hasAvailability: boolean;
    isFullyBooked: boolean;
  };
  canBookThisSlot: (slot: SlotConfig) => { ok: boolean; reason?: string };
  bookSlot: (slot: SlotConfig) => void;
  cancelSlot: (slot: SlotConfig) => void;
}) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  // Αν ένα επιλεγμένο slot πάψει να είναι διαθέσιμο, αποεπιλογή με effect
  useEffect(() => {
    if (!selectedTime) return;
    const sel = slots.find(s => s.time === selectedTime);
    if (!sel) return;

    const now = new Date();
    const isToday = date === todayISO();
    const start = toDateAt(date, sel.time);
    const diffMs = start.getTime() - now.getTime();
    const isPastOrStarted = isToday && now >= start;
    const cutoffPassed = isToday && diffMs < 30 * 60 * 1000;

    const { hasAvailability } = availabilityFor(sel.time, sel.capacityMain, sel.capacityWait);
    const alreadyMine = myBookingTime === sel.time;

    const disabledUI =
      !dateAllowed ||
      isPastOrStarted ||
      (!alreadyMine && cutoffPassed) ||
      (!alreadyMine && !hasAvailability);

    if (disabledUI) setSelectedTime(null);
  }, [selectedTime, slots, date, dateAllowed, myBookingTime, availabilityFor]);

  const now = new Date();
  const isToday = date === todayISO();

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {slots.map((slot) => {
          const { id, time, label, capacityMain, capacityWait } = slot;
          const { main, wait, mainLeft, waitLeft, hasAvailability, isFullyBooked } =
            availabilityFor(time, capacityMain, capacityWait);

          const start = toDateAt(date, time);
          const diffMs = start.getTime() - now.getTime();
          const isPastOrStarted = isToday && now >= start;
          const cutoffPassed = isToday && diffMs < 30 * 60 * 1000;
          const alreadyMine = myBookingTime === time;

          const rule = canBookThisSlot(slot);
          const disabledUI =
            !dateAllowed ||
            isPastOrStarted ||
            (!alreadyMine && cutoffPassed) ||
            (!alreadyMine && !hasAvailability);

          const isSelected = selectedTime === time;

          let cardClasses =
            'relative w-full rounded border p-2 transition text-sm';
          if (isSelected) {
            // απαλά πράσινο περίγραμμα + γκριζοπράσινο background
            cardClasses += ' border-emerald-600 bg-emerald-900/10';
          } else {
            cardClasses += ' border-zinc-800 bg-zinc-900 hover:border-zinc-700';
          }
          cardClasses += disabledUI ? ' opacity-60 cursor-not-allowed' : ' cursor-pointer';

          const handleClick = () => {
            if (!disabledUI) setSelectedTime(time);
          };

          // Εμφάνιση μικρού κουμπιού μόνο όταν είναι επιλεγμένο
          const canShowAction = isSelected;

          // Compact info line
          let infoEl: React.ReactNode;
          if (!dateAllowed) {
            infoEl = <span className="text-zinc-400">Bookable only for today & tomorrow</span>;
          } else if (isPastOrStarted) {
            infoEl = <span className="text-red-400">Unavailable (past/started)</span>;
          } else if (!alreadyMine && cutoffPassed) {
            infoEl = <span className="text-red-400">Bookings close 30’ before start</span>;
          } else if (!alreadyMine && isFullyBooked) {
            infoEl = <span className="text-red-400">Full incl. waitlist</span>;
          } else if (alreadyMine) {
            infoEl = <span className="text-emerald-400">You are booked here</span>;
          } else if (mainLeft > 0) {
            infoEl = <span className="text-emerald-400">Spots left: {mainLeft}</span>;
          } else {
            infoEl = <span className="text-yellow-400">Waitlist left: {waitLeft}</span>;
          }

          return (
            <div key={id} onClick={handleClick} className={cardClasses}>
              <div className="flex items-center gap-2">
                <div className="text-[13px] font-semibold leading-none">{time}</div>
                {label ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300 capitalize">
                    {label}
                  </span>
                ) : null}

                {/* μικρό κουμπί κάτω-δεξιά */}
                {canShowAction && (
                  <div className="absolute right-2 bottom-2">
                    {alreadyMine ? (
                      <button
                        className="px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-[11px] leading-none"
                        onClick={(e) => { e.stopPropagation(); cancelSlot(slot); }}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-[11px] leading-none"
                        disabled={disabledUI || !rule.ok}
                        title={rule.ok ? 'Book this class' : rule.reason}
                        onClick={(e) => { e.stopPropagation(); bookSlot(slot); }}
                      >
                        BOOK NOW
                      </button>
                    )}
                  </div>
                )}

                <div className="ml-auto text-[11px] text-zinc-400">
                  {main}/{capacityMain} • WL {wait}/{capacityWait}
                </div>
              </div>

              <div className="mt-1 text-[12px] min-h-[1rem]">
                {infoEl}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-xs text-zinc-500">
        Tap a slot to reveal the bottom-right action. Bookings close <b>30’</b> before start. One booking per day.
      </div>
    </>
  );
}
