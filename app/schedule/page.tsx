// app/schedule/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
// Assume DateStepper component path is correct
// import DateStepper from '/components/DateStepper'; // Assuming PascalCase for component

/* ========================= types ========================= */

type SlotConfig = {
  id: string;
  time: string;           // "hh:mm"
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

// per-date overrides: yyyy-mm-dd -> slots for that exact date
type ScheduleOverrides = Record<string, SlotConfig[]>;

type DayBookings = Record<string, { main: string[]; wait: string[] }>;

/* ===================== constants/helpers ===================== */

const weekdays_full = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const today = () => new Date();
const todayIso = () => today().toISOString().slice(0, 10);
const nowHourMinute = () => today().toTimeString().slice(0, 5); // "hh:mm"

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

/**
 * Ελέγχει αν η ημερομηνία είναι σήμερα ή αύριο (με ειδική λογική για Σάββατο)
 */
function isDateBookable(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(dateStr + 'T00:00:00'); // Χρήση T00:00:00 για αποφυγή timezone issues
  selectedDate.setHours(0, 0, 0, 0);

  const todayTime = today.getTime();
  const selectedTime = selectedDate.getTime();

  // 1. Έλεγχος για σήμερα
  if (selectedTime === todayTime) {
    return true;
  }

  // Υπολογισμός αύριο
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Ειδική λογική για Σάββατο: αν είναι Σάββατο (Day 6), το bookable "αύριο" είναι Δευτέρα (Day 1), δηλαδή 2 μέρες μετά.
  if (today.getDay() === 6) { 
      const dayAfterTomorrow = new Date(today);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

      // Ελέγχουμε αν είναι η αυριανή (Κυριακή - Day 0) Ή η μεθαυριανή (Δευτέρα - Day 1)
      // Εφόσον ο κανόνας είναι "Σήμερα ή Αύριο/Δευτέρα", πρέπει να ελέγξουμε μόνο την Δευτέρα αν είναι Σάββατο
      if (selectedTime === dayAfterTomorrow.getTime()) {
        return true; // Δευτέρα
      }

  } else {
      // Για όλες τις άλλες ημέρες, απλά ελέγχουμε την επόμενη ημέρα
      if (selectedTime === tomorrow.getTime()) {
        return true;
      }
  }

  return false;
}

/* ===================== default templates (no change) ===================== */

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
  // ensure 17:00 exists on Mon–Fri (1..5)
  for (const d of [1, 2, 3, 4, 5]) {
    const day = next.byDow[d] ?? { slots: [] };
    next.byDow[d] = { slots: ensureSlotExists(day.slots, '17:00') };
  }
  return next;
}
/* ===================== main component ===================== */

export default function SchedulePage() {
  const [date, setDate] = useState<string>(todayIso());
  const dow = useMemo(() => new Date(date + 'T00:00:00').getDay(), [date]);
  const weekdayName = weekdays_full[dow];

  // Κατάσταση για τις κρατήσεις του χρήστη (Ψεύτικα Δεδομένα)
  // userBookings: Record<dateIso: string, slotTime: string>
  const [userBookings, setUserBookings] = useState<Record<string, string>>({});
  
  // Flag για τον κανόνα: Μόνο μια κράτηση την ημέρα
  const hasBookingForSelectedDay = useMemo(() => !!userBookings[date], [userBookings, date]);


  // base templates (per dow)
  const [config, setConfig] = useState<ScheduleConfig>(defaultConfig());
  // per-date overrides
  const [overrides, setOverrides] = useState<ScheduleOverrides>({});

  // day bookings (display only for now)
  const [dayData, setDayData] = useState<DayBookings>({});

  // editor state
  const [editing, setEditing] = useState<boolean>(false);
  const [draftSlots, setDraftSlots] = useState<SlotConfig[]>([]);
  const [applyScope, setApplyScope] = useState<'date' | 'weekday' | 'weekdays'>('weekday'); // επιλογή αποθήκευσης

  // load config/overrides on mount
  useEffect(() => {
    // ... (logic for loading config/overrides is the same)
    const rawc = localStorage.getItem(keyConfig);
    if (rawc) {
      try {
        const parsed = JSON.parse(rawc) as ScheduleConfig;
         const migrated = migrateConfig(parsed);
         setConfig(migrated);
         if (JSON.stringify(migrated) !== rawc) {
          localStorage.setItem(keyConfig, JSON.stringify(migrated));
         }
      } catch {}
    }
    const rawo = localStorage.getItem(keyOverrides);
    if (rawo) {
      try {
        setOverrides(JSON.parse(rawo) as ScheduleOverrides);
      } catch {}
    }
    
    // Φόρτωση Ψεύτικων Κρατήσεων Χρήστη (π.χ. μία κράτηση αύριο στις 18:00)
    const tomorrow = new Date(today());
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10);
    setUserBookings({
        // [tomorrowIso]: '18:00' // uncomment to test the 'user already booked' rule
    });
  }, []);

  // load bookings per selected date
  useEffect(() => {
    const raw = localStorage.getItem(keyBookings(date));
    setDayData(raw ? (JSON.parse(raw) as DayBookings) : {});
  }, [date]);

  // visible slots: override wins, otherwise template by dow
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

  const countsFor = (time: string) => {
    const rec = dayData[time];
    return { main: rec?.main?.length || 0, wait: rec?.wait?.length || 0 };
  };

  /**
   * Τροποποιημένη συνάρτηση ελέγχου διαθεσιμότητας και bookability
   */
  const availabilityFor = (time: string, capMain: number, capWait: number) => {
    const { main, wait } = countsFor(time);
    const mainLeft = Math.max(capMain - main, 0);
    const waitLeft = Math.max(capWait - wait, 0);
    const hasAvailability = main < capMain || (main >= capMain && wait < capWait);
    
    // Κανόνας 4 & 1: Τμήματα που είναι πριν την τωρινή ώρα + 30'
    let isPastOrTooClose = false;
    const isToday = todayIso() === date;

    if (isToday) {
      // Δημιουργία αντικειμένου Date για την ώρα έναρξης του slot
      const slotDateTime = new Date(`${date}T${time}:00`);

      // Ώρα τώρα + 30 λεπτά (όριο κράτησης)
      const nowPlus30 = new Date();
      nowPlus30.setMinutes(nowPlus30.getMinutes() + 30);

      // Το slot είναι ανενεργό (πριν ή εντός 30') αν η ώρα έναρξης του slot είναι πριν την ώρα "τώρα + 30 λεπτά"
      isPastOrTooClose = slotDateTime < nowPlus30;
    }

    // Κανόνας 5: Τμήματα που έχουν γεμίσει οι θέσεις τους και του WL
    const isFullyBooked = main >= capMain && wait >= capWait;

    // Κανόνας 3: Μόνο μια κράτηση την ημέρα (ελέγχεται στο SlotsGrid)
    const userAlreadyBooked = hasBookingForSelectedDay;

    // Ελέγχει αν το slot μπορεί να γίνει book τώρα
    // ΣΗΜΕΙΩΣΗ: Ο έλεγχος για 'userAlreadyBooked' και 'isBookableDay' θα γίνει στον γονικό SlotsGrid
    const canBookThisSlot = hasAvailability && !isPastOrTooClose && !isFullyBooked;
    
    // Ελέγχει αν το slot πρέπει να φαίνεται "ανενεργό" στο UI (π.χ. παρελθόν ή γεμάτο)
    const isDisabled = isFullyBooked || isPastOrTooClose;
    
    return { 
      main, 
      wait, 
      mainLeft, 
      waitLeft, 
      hasAvailability,
      isFullyBooked,
      isPastOrTooClose,
      userAlreadyBooked,
      canBookThisSlot, // Νέο flag για το κουμπί Book Now
      isDisabled, // Νέο flag για το UI
    };
  };

  const onToggleEditor = () => setEditing((v) => !v);

  /* ---------------- editor helpers (no change) ---------------- */

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

    // Clear override for the current date if it exists
    if (overrides[date]) {
      const { [date]: _omit, ...rest } = overrides;
      setOverrides(rest);
      localStorage.setItem(keyOverrides, JSON.stringify(rest));
    }

  } else if (applyScope === 'weekdays') {
    const next: ScheduleConfig = { byDow: { ...config.byDow } };
    for (const d of [1, 2, 3, 4, 5]) {
      next.byDow[d] = { slots: norm.map(s => ({ ...s })) }; // clone per day
    }
    setConfig(next);
    localStorage.setItem(keyConfig, JSON.stringify(next));

    // Clear override for the current date if it exists and it's a weekday
    if (overrides[date] && dow >= 1 && dow <= 5) {
      const { [date]: _omit, ...rest } = overrides;
      setOverrides(rest);
      localStorage.setItem(keyOverrides, JSON.stringify(rest));
    }

  } else {
    // applyScope === 'date'
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

  /* ---------------- render ---------------- */

  // Κανόνας 2: Έλεγχος αν η ημερομηνία είναι bookable
  const isBookableDay = isDateBookable(date);
  
  // Υπολογισμός μηνύματος για την ημέρα
  let dayMessage = '';
  if (!isBookableDay) {
      dayMessage = 'Bookings are only allowed for today or tomorrow (or Monday if it\'s Saturday).';
  } else if (hasBookingForSelectedDay) {
      dayMessage = `You already have a booking for ${date} at ${userBookings[date]}.`;
  }
  
  return (
    <section className="max-w-4xl">
      {/* header */}
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Schedule</h1>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onToggleEditor}
            className={`px-3 py-2 rounded border border-zinc-700 text-sm ${
              editing ? 'bg-zinc-800' : 'hover:bg-zinc-800'
            }`}
          >
            {editing ? 'Close Editor' : 'Change Schedule'}
          </button>
         {/* Ensure DateStepper is correctly imported and named */}
         {/* <DateStepper value={date} onChange={setDate} /> */}
         {/* Placeholder for DateStepper */}
         <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
         />
        </div>
      </div>

      {/* info line */}
      <div className="text-sm text-zinc-400 mb-3">
        {weekdayName} • {date}{' '}
        {overrides[date] ? (
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-amber-700 text-amber-300">
            Override
          </span>
        ) : null}
      </div>
      
      {/* Day Message for Booking Rules */}
      {dayMessage ? (
          <div className="p-3 mb-4 rounded border border-red-700 bg-red-900/20 text-sm text-red-300">
              {dayMessage}
          </div>
      ) : null}

      {/* editor (No Change) */}
      {editing ? (
        <div className="border border-zinc-800 bg-zinc-900 rounded p-4">
          {/* ... (Editor content is the same) ... */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="font-semibold">
              Editing schedule for: {weekdayName} ({date})
            </div>
            <div className="text-xs text-zinc-400">
              Sunday is rest day by default; you can add slots only via date override.
            </div>
          </div>

          {/* save scope */}
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

          {/* table of slots */}
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
                          placeholder="hh:mm"
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
                            <option value="competitive">competitive</option>
                            <option value="novice">novice</option>
                            <option value="advanced">advanced</option>
                            <option value="custom">custom…</option>
                          </select>
                          {/* free text όταν είναι custom (ή κενό) */}
                          {!isPresetLabel(s.label || '') && (
                            <input
                              value={s.label === 'custom' ? '' : (s.label || '')}
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
              + Add Slot
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
            <span className="mx-1 font-medium">“this date only”</span> and saving.
          </div>
        </div>
      ) : (
        // view mode
        <>
          {visibleSlots.length === 0 ? (
            <div className="p-4 border border-zinc-800 bg-zinc-900 rounded">
              {weekdayName === 'Sunday'
                ? 'Rest day. No classes scheduled. (You can add a date override if needed.)'
                : `No slots configured for ${weekdayName}. Click “Change Schedule” to add slots.`}
            </div>
          ) : (
            <SlotsGrid
              slots={visibleSlots}
              date={date}
              countsFor={countsFor}
              availabilityFor={availabilityFor}
              isBookableDay={isBookableDay} // Νέα Prop
              userAlreadyBooked={hasBookingForSelectedDay} // Νέα Prop
            />
          )}
        </>
      )}
    </section>
  );
}

/* ===================== subcomponent (Τροποποιημένο) ===================== */

function SlotsGrid({
  slots,
  date,
  countsFor,
  availabilityFor,
  isBookableDay,
  userAlreadyBooked,
}: {
  slots: SlotConfig[];
  date: string;
  countsFor: (time: string) => { main: number; wait: number };
  availabilityFor: (
      time: string, 
      capMain: number, 
      capWait: number
  ) => {
    main: number;
    wait: number;
    mainLeft: number;
    waitLeft: number;
    hasAvailability: boolean;
    isFullyBooked: boolean;
    isPastOrTooClose: boolean;
    userAlreadyBooked: boolean;
    canBookThisSlot: boolean; // Δείχνει αν το slot είναι bookable ΑΝ η ημέρα είναι bookable
    isDisabled: boolean; // Δείχνει αν το slot είναι Full/Past
  };
  isBookableDay: boolean;
  userAlreadyBooked: boolean;
}) {
  // State για την παρακολούθηση του ID του επιλεγμένου slot
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Toggle function για την επιλογή του slot
  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlotId(currentId => (currentId === slotId ? null : slotId));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {slots.map((slot) => {
        const { id, time, label, capacityMain, capacityWait } = slot;
        const { 
            main, 
            wait, 
            mainLeft, 
            waitLeft, 
            hasAvailability, 
            isFullyBooked, 
            isPastOrTooClose,
            canBookThisSlot, 
            isDisabled 
        } = availabilityFor(
          time,
          capacityMain,
          capacityWait
        );

        // Έλεγχος αν το τρέχον slot είναι επιλεγμένο
        const isSelected = id === selectedSlotId;
        
        // **Κανόνας 2/3/5: Τελικός έλεγχος για το αν μπορεί να γίνει book.**
        const isActuallyBookable = canBookThisSlot && isBookableDay && !userAlreadyBooked;


        // **ΚΑΘΟΡΙΣΜΟΣ ΣΤΥΛ:**
        let slotClasses = 'w-full text-left rounded border p-3 transition';
        let clickCursor = 'cursor-pointer';
        
        if (!isBookableDay || isDisabled || userAlreadyBooked) {
             // Το slot είναι ΑΝΕΝΕΡΓΟ: είτε η ημέρα δεν επιτρέπεται, είτε είναι Full/Past, είτε ο χρήστης έχει ήδη κράτηση
             slotClasses += ' border-zinc-900 bg-zinc-950 text-zinc-500 opacity-70';
             clickCursor = 'cursor-not-allowed';
             // Αποεπιλογή αν είναι επιλεγμένο και έγινε ανενεργό
             if (isSelected) {
                 setSelectedSlotId(null);
             }
        } else if (isSelected) {
             // Ενεργό και Επιλεγμένο
             slotClasses += ' border-emerald-600 bg-emerald-900/20';
        } else {
             // Ενεργό και Μη Επιλεγμένο
             slotClasses += ' border-zinc-800 bg-zinc-900 hover:border-zinc-700';
        }

        // Εφαρμογή του cursor
        slotClasses += ` ${clickCursor}`;
        
        // Λογική για το κλικ στο slot (επιλογή/αποεπιλογή), μόνο αν μπορεί να γίνει book.
        const handleSlotClick = () => {
             if (isActuallyBookable) {
                toggleSlotSelection(id);
            }
        };

        // Καθορισμός κειμένου διαθεσιμότητας
        let availabilityText;
        if (isFullyBooked) {
            availabilityText = <span className="text-red-400">Full (including waitlist)</span>;
        } else if (isPastOrTooClose) {
            availabilityText = <span className="text-red-400">Booking closed (less than 30' remaining)</span>;
        } else if (hasAvailability) {
            availabilityText = (
                <span className="text-emerald-400">
                    {mainLeft > 0 ? `Spots left: ${mainLeft}` : `Waitlist left: ${waitLeft}`}
                </span>
            );
        } else {
            // Αυτό συμβαίνει αν το hasAvailability είναι false, αλλά το isFullyBooked είναι false (πρέπει να είναι full WL)
            availabilityText = <span className="text-red-400">Full Capacity, Waitlist Full</span>;
        }
        
        // Τελικό κείμενο κουμπιού
        let buttonText = 'Book Now';
        if (!isBookableDay) {
            buttonText = 'Day Not Bookable';
        } else if (userAlreadyBooked) {
            buttonText = 'Already Booked Today';
        } else if (isDisabled) {
            buttonText = isFullyBooked ? 'Full' : 'Booking Closed';
        }


        return (
          <div
            key={id}
            onClick={handleSlotClick}
            className={slotClasses}
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
                {availabilityText}
            </div>

            {/* Book Now Button - εμφανίζεται ΜΟΝΟ αν το slot είναι επιλεγμένο */}
            {isSelected && (
              <div className="mt-3 flex justify-center">
                <button
                    className={`px-4 py-2 rounded text-white text-sm ${
                        isActuallyBookable 
                            ? 'bg-emerald-600 hover:bg-emerald-700' 
                            : 'bg-zinc-700 cursor-not-allowed'
                    }`}
                    disabled={!isActuallyBookable}
                    onClick={(e) => {
                        e.stopPropagation(); 
                        if (isActuallyBookable) {
                            alert(`Booking flow for ${slot.time} on ${date} started...`);
                            // Εδώ θα έμπαινε η κλήση για την πραγματική κράτηση
                        }
                    }}
                  >
                    {buttonText}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
