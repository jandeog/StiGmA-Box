// app/schedule/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import DateStepper from '@/components/DateStepper';


/* ========================= Types ========================= */

type SlotConfig = {
  id: string;
  time: string;           // "HH:MM"
  capacityMain: number;   // διαθέσιμες θέσεις
  capacityWait: number;   // θέσεις αναμονής
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

/* ===================== Constants/Helpers ===================== */

const WEEKDAYS_FULL = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const todayISO = () => new Date().toISOString().slice(0, 10);

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

/* ===================== Default Templates ===================== */

// Weekdays (Mon–Fri) default slots incl. 17:00
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

// Saturday default: 10:00 & 18:00
const defaultSaturdaySlots = (): SlotConfig[] => [
  { id: crypto.randomUUID(), time: '10:00', capacityMain: 12, capacityWait: 2 },
  { id: crypto.randomUUID(), time: '18:00', capacityMain: 12, capacityWait: 2 },
];

// Sunday (rest day): no slots by default

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
/* ===================== Main Component ===================== */

export default function SchedulePage() {
  const [date, setDate] = useState<string>(todayISO());
  const dow = useMemo(() => new Date(date + 'T00:00:00').getDay(), [date]);
  const weekdayName = WEEKDAYS_FULL[dow];

  // Base templates (per DOW)
  const [config, setConfig] = useState<ScheduleConfig>(defaultConfig());
  // Per-date overrides
  const [overrides, setOverrides] = useState<ScheduleOverrides>({});

  // Day bookings (display only for now)
  const [dayData, setDayData] = useState<DayBookings>({});

  // Editor state
  const [editing, setEditing] = useState<boolean>(false);
  const [draftSlots, setDraftSlots] = useState<SlotConfig[]>([]);
  const [applyScope, setApplyScope] = useState<'date' | 'weekday' | 'weekdays'>('weekday'); // επιλογή αποθήκευσης

  // Load config/overrides on mount
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

  // Load bookings per selected date
  useEffect(() => {
    const raw = localStorage.getItem(keyBookings(date));
    setDayData(raw ? (JSON.parse(raw) as DayBookings) : {});
  }, [date]);

  // visible slots: override wins, otherwise template by DOW
  const visibleSlots: SlotConfig[] = useMemo(() => {
    const ov = overrides[date];
    if (ov) return ov.slice().sort((a, b) => a.time.localeCompare(b.time));
    const base = config.byDow[dow]?.slots ?? [];
    return base.slice().sort((a, b) => a.time.localeCompare(b.time));
  }, [overrides, date, config, dow]);

  // start editing (prefill from override if exists, else from template)
  useEffect(() => {
    if (!editing) return;
    const ov = overrides[date];
    if (ov) {
      setDraftSlots(ov.map((s) => ({ ...s })));
      setApplyScope('date'); // αν υπάρχει override, προτείνουμε "this date only"
    } else {
      const base = config.byDow[dow]?.slots ?? [];
      setDraftSlots(base.map((s) => ({ ...s })));
      setApplyScope('weekday'); // διαφορετικά προτείνουμε μόνιμη αλλαγή
    }
  }, [editing, date, dow, config, overrides]);

  const isSunday = dow === 0;

  const countsFor = (time: string) => {
    const rec = dayData[time];
    return { main: rec?.main?.length || 0, wait: rec?.wait?.length || 0 };
  };

  const availabilityFor = (time: string, capMain: number, capWait: number) => {
    const { main, wait } = countsFor(time);
    const mainLeft = Math.max(capMain - main, 0);
    const waitLeft = Math.max(capWait - wait, 0);
    const hasAvailability = main < capMain || (main >= capMain && wait < capWait);
    return { main, wait, mainLeft, waitLeft, hasAvailability };
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
  } else if (applyScope === 'weekdays') {
    const next: ScheduleConfig = { byDow: { ...config.byDow } };
    for (const d of [1, 2, 3, 4, 5]) {
      next.byDow[d] = { slots: norm.map(s => ({ ...s })) }; // clone per day
    }
    setConfig(next);
    localStorage.setItem(keyConfig, JSON.stringify(next));
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

  return (
    <section className="max-w-4xl">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
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
         <DateStepper value={date} onChange={setDate} />
        </div>
      </div>

      {/* Info line */}
      <div className="text-sm text-zinc-400 mb-3">
        {weekdayName} • {date}{' '}
        {overrides[date] ? (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-amber-700 text-amber-300">
            Override
          </span>
        ) : null}
      </div>

      {/* EDITOR */}
      {editing ? (
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
            + <label className="text-sm flex items-center gap-2">
<input
type="radio"
  name="scope"
     value="weekdays"
    checked={applyScope === 'weekdays'}
    onChange={() => setApplyScope('weekdays')}
     />
+   Every weekday (Mon–Fri)
+ </label>
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
                                // επιτρέπουμε free text στο διπλανό input
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
                          {/* Free text όταν είναι custom (ή κενό) */}
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
                onClick={() => setEditing(false)}
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
      ) : (
        // VIEW MODE
        <>
          {visibleSlots.length === 0 ? (
            <div className="p-4 border border-zinc-800 bg-zinc-900 rounded">
              {weekdayName === 'Sunday'
                ? 'Rest day. No classes scheduled. (You can add a date override if needed.)'
                : `No slots configured for ${weekdayName}. Click “Change schedule” to add slots.`}
            </div>
          ) : (
            <SlotsGrid
              slots={visibleSlots}
              date={date}
              countsFor={countsFor}
              availabilityFor={availabilityFor}
            />
          )}
        </>
      )}
    </section>
  );
}

/* ===================== Subcomponent ===================== */

function SlotsGrid({
  slots,
  date,
  countsFor,
  availabilityFor,
}: {
  slots: SlotConfig[];
  date: string;
  countsFor: (time: string) => { main: number; wait: number };
  availabilityFor: (time: string, capMain: number, capWait: number) => {
    main: number;
    wait: number;
    mainLeft: number;
    waitLeft: number;
    hasAvailability: boolean;
  };
}) {
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {slots.map((slot) => {
          const { time, label, capacityMain, capacityWait } = slot;
          const { main, wait, mainLeft, waitLeft, hasAvailability } = availabilityFor(
            time,
            capacityMain,
            capacityWait
          );
          return (
            <button
              key={slot.id}
              onClick={() => setSelectedTime(time)}
              className={`w-full text-left rounded border p-3 transition ${
                selectedTime === time
                  ? 'border-zinc-500 bg-zinc-900'
                  : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center">
                <div className="text-lg font-semibold">{time}</div>
                {label ? (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300 capitalize">
                    {label}
                  </span>
                ) : null}
                <div className="ml-auto text-xs text-zinc-400">
                  {main}/{capacityMain} • WL {wait}/{capacityWait}
                </div>
              </div>
              <div className="mt-1 text-sm">
                {hasAvailability ? (
                  <span className="text-emerald-400">
                    {mainLeft > 0 ? `Spots left: ${mainLeft}` : `Waitlist left: ${waitLeft}`}
                  </span>
                ) : (
                  <span className="text-red-400">Full (including waitlist)</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="mt-5">
        {!selectedTime ? (
          <div className="text-sm text-zinc-400">Select a time slot to see details.</div>
        ) : (
          (() => {
            const slot = slots.find((s) => s.time === selectedTime);
            if (!slot) return null;
            const { main, wait, mainLeft, waitLeft, hasAvailability } = availabilityFor(
              slot.time,
              slot.capacityMain,
              slot.capacityWait
            );
            return (
              <div className="border border-zinc-800 bg-zinc-900 rounded p-4">
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold">{slot.time}</div>
                  {slot.label ? (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300 capitalize">
                      {slot.label}
                    </span>
                  ) : null}
                  <div className="ml-auto text-sm text-zinc-400">
                    {main}/{slot.capacityMain} • WL {wait}/{slot.capacityWait}
                  </div>
                </div>

                <div className="text-sm text-zinc-400 mt-1">{date}</div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="text-sm">
                    {hasAvailability ? (
                      <span className="text-emerald-400">
                        {mainLeft > 0 ? `Spots left: ${mainLeft}` : `Waitlist left: ${waitLeft}`}
                      </span>
                    ) : (
                      <span className="text-red-400">No availability</span>
                    )}
                  </div>
                  {hasAvailability ? (
                    <button
                      className="ml-auto px-4 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
                      onClick={() => alert('Booking flow coming next')}
                    >
                      BOOK NOW
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })()
        )}
      </div>
    </>
  );
}
