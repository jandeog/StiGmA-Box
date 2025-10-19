// app/schedule/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

// ---- Types ----

type DbSchedule = {
  id: string;
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM:SS
  end_time: string | null;
  title: string;
  coach_id: string | null;
  capacity_main: number | null;
  capacity_wait: number | null;
};

type DbBooking = {
  id: string;
  schedule_id: string;
  athlete_id: string;
  is_waitlist: boolean;
};

type Profile = {
  id: string;
  full_name: string | null;
};

// ---- Helpers ----

function formatHM(t: string | null | undefined) {
  if (!t) return '';
  return t.slice(0, 5);
}

function toDateAt(dateISO: string, hhmm: string) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const [H, M] = hhmm.split(':').map(Number);
  return new Date(y, (m - 1), d, H, M);
}

function isoToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

// ---- Component ----

export default function SchedulePage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [date, setDate] = useState<string>(isoToday());
  const [rows, setRows] = useState<DbSchedule[]>([]);
  const [bookings, setBookings] = useState<Record<string, DbBooking[]>>({});
  const [namesByAthlete, setNamesByAthlete] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<'coach' | 'athlete' | null>(null);

  const CAP_MAIN_DEFAULT = 14; // per your request
  const CAP_WAIT_DEFAULT = 2;

  // load auth
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        const u = data.user || null;
        setUserId(u?.id ?? null);
        // try user_metadata.role, else localStorage fallback
        const r = (u?.user_metadata as any)?.role as 'coach' | 'athlete' | undefined;
        if (r) setRole(r);
        else {
          try {
            const raw = localStorage.getItem('auth:user');
            const parsed = raw ? JSON.parse(raw) : null;
            const rr = parsed?.role as 'coach' | 'athlete' | undefined;
            setRole(rr ?? null);
          } catch {}
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, [supabase]);

  const isCoach = role === 'coach';

  // load schedule + bookings for selected date
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      const { data: sched, error } = await supabase
        .from('schedule')
        .select('id,event_date,start_time,end_time,title,coach_id,capacity_main,capacity_wait')
        .eq('event_date', date)
        .order('start_time', { ascending: true });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      if (!mounted) return;
      setRows(sched || []);

      const ids = (sched || []).map((r) => r.id);
      if (ids.length === 0) {
        setBookings({});
        setNamesByAthlete({});
        setLoading(false);
        return;
      }

      const { data: bks, error: bErr } = await supabase
        .from('schedule_booking')
        .select('id,schedule_id,athlete_id,is_waitlist')
        .in('schedule_id', ids);

      if (bErr) {
        console.error(bErr);
        setLoading(false);
        return;
      }

      const athleteIds = Array.from(new Set((bks || []).map((b) => b.athlete_id)));
      let nameMap: Record<string, string> = {};
      if (athleteIds.length > 0) {
        // Adjust table/columns to your profiles table
        const { data: ns } = await supabase
          .from('profiles') // <-- change if different
          .select('id, full_name')
          .in('id', athleteIds);
        (ns as Profile[] | null)?.forEach((p) => (nameMap[p.id] = p.full_name || '—'));
      }

      const bySched: Record<string, DbBooking[]> = {};
      (bks || []).forEach((b) => {
        bySched[b.schedule_id] ??= [];
        bySched[b.schedule_id].push(b);
      });

      if (!mounted) return;
      setBookings(bySched);
      setNamesByAthlete(nameMap);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [date, supabase]);

  const now = new Date();
  const isToday = date === isoToday();

  const myBookingScheduleId: string | null = useMemo(() => {
    if (!userId) return null;
    for (const r of rows) {
      const arr = bookings[r.id] || [];
      if (arr.some((b) => b.athlete_id === userId)) return r.id;
    }
    return null;
  }, [rows, bookings, userId]);

  const countsFor = useCallback(
    (scheduleId: string) => {
      const arr = bookings[scheduleId] || [];
      return {
        main: arr.filter((b) => !b.is_waitlist).length,
        wait: arr.filter((b) => b.is_waitlist).length,
      };
    },
    [bookings]
  );

  const availabilityFor = useCallback(
    (row: DbSchedule) => {
      const { main, wait } = countsFor(row.id);
      const capMain = row.capacity_main ?? CAP_MAIN_DEFAULT;
      const capWait = row.capacity_wait ?? CAP_WAIT_DEFAULT;
      const mainLeft = Math.max(capMain - main, 0);
      const waitLeft = Math.max(capWait - wait, 0);
      const hasAvailability = main < capMain || (main >= capMain && wait < capWait);
      const isFullyBooked = main >= capMain && wait >= capWait;
      return { main, wait, mainLeft, waitLeft, hasAvailability, isFullyBooked, capMain, capWait };
    },
    [countsFor]
  );

  function bookingRule(row: DbSchedule): { ok: boolean; reason?: string } {
    if (!userId) return { ok: false, reason: 'Please login first.' };

    const start = toDateAt(row.event_date, formatHM(row.start_time));
    if (isToday && now >= start) return { ok: false, reason: 'This class has already started or finished.' };

    if (isToday) {
      const diffMs = start.getTime() - now.getTime();
      if (diffMs < 30 * 60 * 1000) return { ok: false, reason: 'Bookings close 30 minutes before start.' };
    }

    if (myBookingScheduleId && myBookingScheduleId !== row.id)
      return { ok: false, reason: 'You already booked another slot this day. Cancel it to change.' };

    const { hasAvailability } = availabilityFor(row);
    if (!hasAvailability) return { ok: false, reason: 'Full (including waitlist).' };

    return { ok: true };
  }

  async function bookSlot(row: DbSchedule) {
    if (!userId) return alert('Please login first.');
    const rule = bookingRule(row);
    if (!rule.ok) return alert(rule.reason);

    const { mainLeft, waitLeft } = availabilityFor(row);
    const is_waitlist = mainLeft <= 0 && waitLeft > 0;

    const { error } = await supabase.from('schedule_booking').insert({
      schedule_id: row.id,
      athlete_id: userId,
      is_waitlist,
    });

    if (error) {
      console.error(error);
      return alert('Error while booking.');
    }

    // local optimistic update
    setBookings((prev) => {
      const arr = prev[row.id] ? [...prev[row.id]] : [];
      arr.push({ id: crypto.randomUUID(), schedule_id: row.id, athlete_id: userId, is_waitlist });
      return { ...prev, [row.id]: arr };
    });
  }

  async function cancelSlot(row: DbSchedule) {
    if (!userId) return;
    const { error } = await supabase
      .from('schedule_booking')
      .delete()
      .match({ schedule_id: row.id, athlete_id: userId });

    if (error) {
      console.error(error);
      return alert('Error while cancelling.');
    }

    setBookings((prev) => {
      const arr = (prev[row.id] || []).filter((b) => b.athlete_id !== userId);
      return { ...prev, [row.id]: arr };
    });
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
              Edit day(s)
            </Link>
          )}
        </div>
      </header>

      {loading && (
        <div className="text-sm text-zinc-400">Loading…</div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-sm text-zinc-400">No classes for this day.</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rows.map((row) => {
          const { main, wait, mainLeft, waitLeft, isFullyBooked, capMain, capWait } = availabilityFor(row);
          const arr = bookings[row.id] || [];
          const mine = !!arr.find((b) => b.athlete_id === userId);

          const mainNames = arr.filter((b) => !b.is_waitlist).map((b) => namesByAthlete[b.athlete_id] || '—');
          const waitNames = arr.filter((b) => b.is_waitlist).map((b) => namesByAthlete[b.athlete_id] || '—');
          const compactNames = mainNames.slice(0, 3).join(', ') + (mainNames.length > 3 ? ` +${mainNames.length - 3}` : '');

          return (
            <div key={row.id} className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <div className="text-lg font-medium tracking-tight">
                {formatHM(row.start_time)}
              </div>
              <div className="text-sm text-zinc-400 mb-2">{row.title || 'Class'}</div>

              <div className="flex items-center gap-2 text-xs">
                <span className={"px-2 py-0.5 rounded-full border " + (mainLeft > 0 ? 'border-emerald-700 text-emerald-300' : 'border-zinc-700 text-zinc-400')}>
                  Main {main}/{capMain}
                </span>
                <span className={"px-2 py-0.5 rounded-full border " + (waitLeft > 0 ? 'border-amber-700 text-amber-300' : 'border-zinc-700 text-zinc-400')}>
                  WL {wait}/{capWait}
                </span>
                {compactNames && (
                  <span
                    className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 text-zinc-300"
                    title={`Booked: ${mainNames.join(', ')}${waitNames.length ? ` • WL: ${waitNames.join(', ')}` : ''}`}
                  >
                    {compactNames}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-zinc-500">{row.coach_id ? 'Coach assigned' : '—'}</div>
                <div className="flex items-center gap-2">
                  {mine ? (
                    <button
                      className="px-3 py-1.5 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
                      onClick={() => cancelSlot(row)}
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
                      disabled={isFullyBooked}
                      title={isFullyBooked ? 'Full (including waitlist).' : 'Book this class'}
                      onClick={() => bookSlot(row)}
                    >
                      {isFullyBooked ? 'Full' : 'Book'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
