'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type UserSession = { id: string; name?: string; role?: 'coach' | 'athlete' };
type Slot = {
  id: string;
  time: string;                 // "HH:MM"
  title?: string;               // e.g. "Class" | "competitive"
  capacityMain: number;         // default 14
  capacityWait: number;         // default 2
  participantsMain: string[];   // array of userIds
  participantsWait: string[];   // array of userIds
};
type DayRecord = {
  date: string;                 // "YYYY-MM-DD"
  slots: Slot[];
};
type DaysStore = Record<string, DayRecord>;

const CAP_MAIN_DEFAULT = 14;
const CAP_WAIT_DEFAULT = 2;

const STORAGE_TEMPLATE = 'schedule:template';
const STORAGE_DAYS = 'schedule:days';
const STORAGE_USER = 'auth:user';

// ---------- helpers ----------
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
function formatHM(time: string) {
  // expect "HH:MM" (if "HH:MM:SS" arrives, cut it)
  return time.slice(0, 5);
}
function toDateAt(dateISO: string, hhmm: string) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [H, M] = hhmm.split(':').map(Number);
  return new Date(y, (m - 1), d, H, M);
}
function uid(): string {
  // lightweight uuid
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------- localStorage helpers ----------
type TemplateSlot = { time: string; title?: string; capacityMain?: number; capacityWait?: number; enabled?: boolean };
type WeekTemplate = {
  weekdays: TemplateSlot[];   // Mon-Fri
  saturday: TemplateSlot[];
  sunday: TemplateSlot[];     // usually empty
};

const DEFAULT_TEMPLATE: WeekTemplate = {
  weekdays: [
    { time: '07:00' }, { time: '08:30' }, { time: '09:30' }, { time: '10:30' },
    { time: '17:00' }, { time: '18:00', title: 'competitive' },
    { time: '19:00' }, { time: '20:00' }, { time: '21:00' }
  ],
  saturday: [{ time: '10:00' }, { time: '18:00' }],
  sunday: []
};

function loadTemplate(): WeekTemplate {
  try {
    const raw = localStorage.getItem(STORAGE_TEMPLATE);
    if (!raw) return DEFAULT_TEMPLATE;
    const parsed = JSON.parse(raw) as WeekTemplate;
    return parsed;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

function ensureDay(days: DaysStore, date: string): DaysStore {
  if (days[date]) return days;
  // Build from template by weekday
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun .. 6=Sat
  const tpl = loadTemplate();
  const base: TemplateSlot[] =
    dow === 0 ? tpl.sunday : dow === 6 ? tpl.saturday : tpl.weekdays;

  const slots: Slot[] = base
    .filter(s => s.enabled !== false)
    .map(s => ({
      id: uid(),
      time: s.time,
      title: s.title || 'Class',
      capacityMain: s.capacityMain ?? CAP_MAIN_DEFAULT,
      capacityWait: s.capacityWait ?? CAP_WAIT_DEFAULT,
      participantsMain: [],
      participantsWait: []
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  return {
    ...days,
    [date]: { date, slots }
  };
}

function loadDays(): DaysStore {
  try {
    const raw = localStorage.getItem(STORAGE_DAYS);
    if (!raw) return {};
    return JSON.parse(raw) as DaysStore;
  } catch {
    return {};
  }
}

function saveDays(days: DaysStore) {
  localStorage.setItem(STORAGE_DAYS, JSON.stringify(days));
}

function loadUser(): UserSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? (JSON.parse(raw) as UserSession) : null;
  } catch {
    return null;
  }
}

// ---------- component ----------
export default function SchedulePage() {
  const [date, setDate] = useState<string>(isoToday());
  const [days, setDays] = useState<DaysStore>({});
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const row: DayRecord | null = days[date] ?? null;
  const isCoach = user?.role === 'coach';

  const reload = useCallback(() => {
    setLoading(true);
    const d0 = loadDays();
    const d1 = ensureDay(d0, date);
    setDays(d1);
    setUser(loadUser());
    setLoading(false);
  }, [date]);

  useEffect(() => {
    reload();
  }, [reload]);

  const slots = useMemo<Slot[]>(() => row?.slots ?? [], [row]);

  const now = new Date();
  const isToday = date === isoToday();

  function canBook(slot: Slot): { ok: boolean; reason?: string } {
    if (!user?.id) return { ok: false, reason: 'Please login first.' };

    const start = toDateAt(date, slot.time);
    if (isToday && now >= start) return { ok: false, reason: 'This class has already started or finished.' };

    if (isToday) {
      const diff = start.getTime() - now.getTime();
      if (diff < 30 * 60 * 1000) return { ok: false, reason: 'Bookings close 30 minutes before start.' };
    }

    // one booking per day
    if (row) {
      for (const s of row.slots) {
        const inMain = s.participantsMain.includes(user.id);
        const inWait = s.participantsWait.includes(user.id);
        if ((inMain || inWait) && s.id !== slot.id) {
          return { ok: false, reason: 'You already booked another slot this day. Cancel it to change.' };
        }
      }
    }

    const mainCount = slot.participantsMain.length;
    const waitCount = slot.participantsWait.length;
    const mainLeft = Math.max(slot.capacityMain - mainCount, 0);
    const waitLeft = Math.max(slot.capacityWait - waitCount, 0);
    if (mainLeft <= 0 && waitLeft <= 0) return { ok: false, reason: 'Full (including waitlist).' };

    return { ok: true };
  }

  function amIMember(slot: Slot): boolean {
    if (!user?.id) return false;
    return slot.participantsMain.includes(user.id) || slot.participantsWait.includes(user.id);
  }

  function book(slot: Slot) {
    if (!row || !user?.id) return;
    const rule = canBook(slot);
    if (!rule.ok) {
      alert(rule.reason);
      return;
    }
    const mainCount = slot.participantsMain.length;
    const isWait = mainCount >= slot.capacityMain;

    const updated: DaysStore = { ...days };
    const day = updated[date];
    const nextSlots = day.slots.map(s => {
      if (s.id !== slot.id) return s;
      return {
        ...s,
        participantsMain: isWait ? s.participantsMain : [...s.participantsMain, user.id],
        participantsWait: isWait ? [...s.participantsWait, user.id] : s.participantsWait
      };
    });
    updated[date] = { ...day, slots: nextSlots };
    setDays(updated);
    saveDays(updated);
  }

  function cancel(slot: Slot) {
    if (!row || !user?.id) return;
    const updated: DaysStore = { ...days };
    const day = updated[date];
    const nextSlots = day.slots.map(s => {
      if (s.id !== slot.id) return s;
      return {
        ...s,
        participantsMain: s.participantsMain.filter(x => x !== user.id),
        participantsWait: s.participantsWait.filter(x => x !== user.id)
      };
    });
    updated[date] = { ...day, slots: nextSlots };
    setDays(updated);
    saveDays(updated);
  }

  return (
    <section className="max-w-5xl mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Schedule</h1>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
            onClick={() => setDate(addDays(date, -1))}
          >
            ◀ Prev
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
          />
          <button
            className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
            onClick={() => setDate(addDays(date, +1))}
          >
            Next ▶
          </button>

          {isCoach && (
            <Link
              href="/schedule/edit"
              className="ml-2 px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
            >
              Edit hours
            </Link>
          )}
        </div>
      </header>

      {loading && <div className="text-sm text-zinc-400">Loading…</div>}
      {!loading && (!row || slots.length === 0) && (
        <div className="text-sm text-zinc-400">No classes for this day.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {slots.map((s) => {
          const mainCount = s.participantsMain.length;
          const waitCount = s.participantsWait.length;
          const mainLeft = Math.max(s.capacityMain - mainCount, 0);
          const waitLeft = Math.max(s.capacityWait - waitCount, 0);
          const isFull = mainLeft <= 0 && waitLeft <= 0;
          const mine = amIMember(s);

          // names: απλή απόδοση — αν υπάρχει user.name, δείχνουμε "You" όταν συμμετέχεις
          const compact = mine ? 'You' : (mainCount > 0 ? `${mainCount} booked` : '');

          return (
            <div key={s.id} className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-lg font-medium tracking-tight">{formatHM(s.time)}</div>
              <div className="text-sm text-zinc-400 mb-2">{s.title || 'Class'}</div>

              <div className="flex items-center gap-2 text-xs">
                <span
                  className={
                    'px-2 py-0.5 rounded-full border ' +
                    (mainLeft > 0 ? 'border-emerald-700 text-emerald-300' : 'border-zinc-700 text-zinc-400')
                  }
                >
                  Main {mainCount}/{s.capacityMain}
                </span>
                <span
                  className={
                    'px-2 py-0.5 rounded-full border ' +
                    (waitLeft > 0 ? 'border-amber-700 text-amber-300' : 'border-zinc-700 text-zinc-400')
                  }
                >
                  WL {waitCount}/{s.capacityWait}
                </span>
                {compact && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300">
                    {compact}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                {mine ? (
                  <button
                    className="px-3 py-1.5 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
                    onClick={() => cancel(s)}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
                    disabled={isFull}
                    title={isFull ? 'Full (including waitlist).' : 'Book this class'}
                    onClick={() => book(s)}
                  >
                    {isFull ? 'Full' : 'Book'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
