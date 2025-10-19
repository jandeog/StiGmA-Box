// app/schedule/edit/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function ScheduleEditPage() {
  const supabase = useMemo(() => createClientComponentClient(), []);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [coachId, setCoachId] = useState('');
  const [role, setRole] = useState<'coach' | 'athlete' | null>(null);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data.user || null;
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

  if (role !== 'coach') {
    return (
      <section className="max-w-3xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-3">Change Schedule</h1>
        <div className="p-3 border border-red-700 bg-red-900/20 rounded text-sm text-red-300">
          Only coaches can edit the schedule.
        </div>
        <div className="mt-4">
          <Link href="/schedule" className="text-sm underline text-zinc-300">Back to schedule</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Change Schedule</h1>
        <Link href="/schedule" className="text-sm underline text-zinc-300">Back</Link>
      </header>

      <div className="flex flex-col gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950">
        <div className="text-sm text-zinc-300 font-medium">Apply default timetable to a date range</div>

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
            className="px-3 py-2 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
            onClick={async () => {
              if (!fromDate || !toDate) {
                setMsg('⚠️ Select from/to dates');
                setTimeout(() => setMsg(''), 1800);
                return;
              }
              const { error } = await supabase.rpc('seed_schedule', {
                from_date: fromDate,
                to_date: toDate,
                coach: coachId || null,
              });
              if (error) {
                console.error(error);
                setMsg('❌ Failed to apply');
                setTimeout(() => setMsg(''), 2000);
              } else {
                setMsg('✅ Applied to DB');
                setTimeout(() => setMsg(''), 1600);
              }
            }}
          >
            Apply to DB
          </button>
        </div>

        <div className="text-xs text-zinc-500">
          The RPC seeds Mon–Fri default, Sat special, Sun off. Default capacities: Main 14, WL 2.
        </div>

        {msg && (
          <div className="text-sm text-zinc-300">{msg}</div>
        )}
      </div>
    </section>
  );
}