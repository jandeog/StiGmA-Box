'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

type ScheduleDayRow = {
  event_date: string;
  coach_id: string | null;
  // Τα slot1..slot12 υπάρχουν στο row — τα προσπελάζουμε δυναμικά
  [key: string]: unknown;
};

type Profile = { id: string; full_name: string | null };

type SlotVM = {
  i: number;
  time: string;
  title: string;
  capM: number;
  capW: number;
  mainIds: string[];
  waitIds: string[];
};

const MAX_SLOTS = 12;
const CAP_MAIN_DEFAULT = 14;
const CAP_WAIT_DEFAULT = 2;

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
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

function formatHM(t?: string | null) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

function toDateAt(dateISO: string, hhmm: string) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [H, M] = hhmm.split(':').map(Number);
  return new Date(y, (m - 1), d, H, M);
}

export default function SchedulePage() {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [date, setDate] = useState<string>(isoToday());
  const [row, setRow] = useState<ScheduleDayRow | null>(null);
  const [namesById, setNamesById] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'coach' | 'athlete' | null>(null);
  const [loading, setLoading] = useState(false);

  const isCoach = role === 'coach';

  // auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user || null;
      setUserId(u?.id ?? null);
      const r = (u?.user_metadata as any)?.role as 'coach' | 'athlete' | undefined;
      if (r) setRole(r);
      else {
        // fallback (αν το κρατάς στο localStorage)
        try {
          const raw = localStorage.getItem('auth:user');
          const parsed = raw ? JSON.parse(raw) : null;
          const rr = parsed?.role as 'coach' | 'athlete' | undefined;
          setRole(rr ?? null);
        } catch {}
      }
    })();
  }, [supabase]);

  const reload = useCallback(async () => {
    setLoading(true);
    setRow(null);
    setNamesById({});

    const { data, error } = await supabase
      .from('schedule_day')
      .select('*')
      .eq('event_date', date)
      .maybeSingle();

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const day = (data as ScheduleDayRow) ?? null;
    setRow(day);

    // μάζεψε όλα τα ids των συμμετεχόντων από όλα τα slots
    const ids = new Set<string>();
    if (day) {
      for (let i = 1; i <= MAX_SLOTS; i++) {
        const mainArr = (day[`slot${i}_part_main`] as string[] | null) || [];
        const waitArr = (day[`slot${i}_part_wait`] as string[] | null) || [];
        mainArr.forEach((id: string) => ids.add(id));
        waitArr.forEach((id: string) => ids.add(id));
      }
    }

    if (ids.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles') // προσαρμόσ’ το αν λέγεται αλλιώς
        .select('id, full_name')
        .in('id', Array.from(ids));

      const map: Record<string, string> = {};
      (profiles as Profile[] | null)?.forEach((p) => (map[p.id] = p.full_name || '—'));
      setNamesById(map);
    }

    setLoading(false);
  }, [date, supabase]);

  useEffect(() => {
    reload();
  }, [reload]);

  // φτιάξε τα slots (όπως στο παλιό UI)
  const slots = useMemo<SlotVM[]>(() => {
    if (!row) return [];
    const arr: SlotVM[] = [];
    for (let i = 1; i <= MAX_SLOTS; i++) {
      const t = row[`slot${i}_time`] as string | null | undefined;
      const ttl = row[`slot${i}_title`] as string | null | undefined;
      // κενό slot → skip
      if (!t && !ttl) continue;

      const capM = (row[`slot${i}_cap_main`] as number | null) ?? CAP_MAIN_DEFAULT;
      const capW = (row[`slot${i}_cap_wait`] as number | null) ?? CAP_WAIT_DEFAULT;
      const mainIds = (row[`slot${i}_part_main`] as string[] | null) || [];
      const waitIds = (row[`slot${i}_part_wait`] as string[] | null) || [];

      arr.push({
        i,
        time: formatHM(t ?? ''),
        title: (ttl ?? 'Class'),
        capM,
        capW,
        mainIds,
        waitIds,
      });
    }
    return arr;
  }, [row]);

  const now = new Date();
  const isToday = date === isoToday();

  function canBook(i: number, startHHMM: string) {
    if (!userId) return { ok: false, reason: 'Please login first.' };
    const start = toDateAt(date, startHHMM);
    if (isToday && now >= start) return { ok: false, reason: 'This class has already started or finished.' };
    if (isToday) {
      const diff = start.getTime() - now.getTime();
      if (diff < 30 * 60 * 1000) return { ok: false, reason: 'Bookings close 30 minutes before start.' };
    }

    // one-per-day rule
    if (row) {
      for (let k = 1; k <= MAX_SLOTS; k++) {
        const inMain = ((row[`slot${k}_part_main`] as string[] | null) || []).includes(userId);
        const inWait = ((row[`slot${k}_part_wait`] as string[] | null) || []).includes(userId);
        if ((inMain || inWait) && k !== i) {
          return { ok: false, reason: 'You already booked another slot this day. Cancel it to change.' };
        }
      }
    }

    return { ok: true };
  }

  async function book(i: number) {
    const slot = slots.find((s) => s.i === i);
    if (!slot) return;
    const rule = canBook(i, slot.time);
    if (!rule.ok) return alert(rule.reason);
    const { data, error } = await supabase.rpc('book_slot', { p_date: date, p_slot: i });
    if (error) return alert('Error booking');
    if (String(data || '').startsWith('OK')) reload();
    else alert(String(data));
  }

  async function cancel(i: number) {
    const { error } = await supabase.rpc('cancel_slot', { p_date: date, p_slot: i });
    if (error) return alert('Error cancelling');
    reload();
  }

  function amIMember(i: number) {
    if (!row || !userId) return false;
    const inMain = ((row[`slot${i}_part_main`] as string[] | null) || []).includes(userId);
    const inWait = ((row[`slot${i}_part_wait`] as string[] | null) || []).includes(userId);
    return inMain || inWait;
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
          const mainCount = s.mainIds.length;
          const waitCount = s.waitIds.length;
          const mainLeft = Math.max(s.capM - mainCount, 0);
          const waitLeft = Math.max(s.capW - waitCount, 0);
          const isFull = mainCount >= s.capM && waitCount >= s.capW;
          const mine = amIMember(s.i);

          const mainNames = s.mainIds.map((id: string) => namesById[id] || '—');
          const waitNames = s.waitIds.map((id: string) => namesById[id] || '—');
          const compact =
            mainNames.slice(0, 3).join(', ') +
            (mainNames.length > 3 ? ` +${mainNames.length - 3}` : '');

          return (
            <div key={s.i} className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-lg font-medium tracking-tight">
                {s.time}
              </div>
              <div className="text-sm text-zinc-400 mb-2">{s.title}</div>

              <div className="flex items-center gap-2 text-xs">
                <span
                  className={
                    'px-2 py-0.5 rounded-full border ' +
                    (mainLeft > 0 ? 'border-emerald-700 text-emerald-300' : 'border-zinc-700 text-zinc-400')
                  }
                >
                  Main {mainCount}/{s.capM}
                </span>
                <span
                  className={
                    'px-2 py-0.5 rounded-full border ' +
                    (waitLeft > 0 ? 'border-amber-700 text-amber-300' : 'border-zinc-700 text-zinc-400')
                  }
                >
                  WL {waitCount}/{s.capW}
                </span>
                {compact && (
                  <span
                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300"
                    title={`Booked: ${mainNames.join(', ')}${waitNames.length ? ` • WL: ${waitNames.join(', ')}` : ''}`}
                  >
                    {compact}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                {mine ? (
                  <button
                    className="px-3 py-1.5 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
                    onClick={() => cancel(s.i)}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
                    disabled={isFull}
                    title={isFull ? 'Full (including waitlist).' : 'Book this class'}
                    onClick={() => book(s.i)}
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
