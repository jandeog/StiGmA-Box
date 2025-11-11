'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DateStepper from '@/components/DateStepper';

export default function SchedulePage() {
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [isCoach, setIsCoach] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // 1️⃣ Who am I (same logic as Athletes page)
        const meRes = await fetch('/api/me', { cache: 'no-store' });
        const meJ = await meRes.json();
        if (!meRes.ok || !meJ?.me) {
          console.warn('No session, redirecting...');
          window.location.href = '/';
          return;
        }

        setIsCoach(!!meJ.me.is_coach);
        setOk(true);

       // 2️⃣ Fetch schedule slots for this date
const r = await fetch(`/api/schedule?date=${date}`, { cache: 'no-store' });

let j: any = null;
const raw = await r.text();
try { j = raw ? JSON.parse(raw) : {}; } catch { j = {}; }

if (!r.ok) {
  throw new Error(j?.error || `Failed to load schedule (HTTP ${r.status})`);
}

// Just use the items; schedule_slots has no 'enabled'
const items = Array.isArray(j?.items) ? j.items : [];
setSlots(items);


      } catch (err) {
        console.error('💥 Schedule load failed', err);
        setSlots([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  if (!ok) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
        Loading schedule…
      </div>
    );
  }

  return (
    <section className="max-w-4xl mx-auto p-3">
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Schedule</h1>

        {/* @ts-ignore */}
        <DateStepper
          value={date}
          onChange={(v: string) => {
            setLoading(true); // ✅ δείξε spinner άμεσα
            setDate(v);
          }}
        />

        {isCoach ? (
  <Link
    href="/schedule/edit"
    prefetch={false}
className="ml-auto px-2.5 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-[13px]"
  >
    Edit Schedule
  </Link>
) : null}
      </header>

      {/* 🌀 Working spinner */}
      {loading && (
        <div className="flex items-center justify-center py-10 text-zinc-400 text-sm space-x-2">
          <svg
            className="animate-spin h-5 w-5 text-emerald-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
          <span className="text-emerald-400 font-semibold">Loading classes…</span>
        </div>
      )}

      {!loading && slots.length === 0 && (
        <div className="text-xs text-zinc-400">No classes for this day.</div>
      )}

      {!loading && slots.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {slots.map((s) => (
            <div
              key={s.id ?? `${s.date}-${s.time}`}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-2"
            >
              <div className="flex items-center gap-2">
                <div className="text-base font-medium tracking-tight">
                  {s.time?.slice(0, 5)}
                </div>
                <span className="px-1.5 py-0.5 rounded-md border border-emerald-700 text-emerald-300 text-[10px] leading-none">
                  {s.title}
                </span>
                <span className="px-1.5 py-0.5 rounded-md border border-zinc-700 text-zinc-400 text-[10px] leading-none">
                  Main {s.capacity_main}
                </span>
                <span className="px-1.5 py-0.5 rounded-md border border-zinc-700 text-zinc-400 text-[10px] leading-none">
                  WL {s.capacity_wait}
                </span>
              </div>

              <div className="mt-2 flex justify-end">
                <button
                  className="px-2.5 py-1.5 rounded-lg border border-zinc-700 text-[12px] opacity-40 cursor-not-allowed"
                  disabled
                >
                  Booking soon…
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

}
