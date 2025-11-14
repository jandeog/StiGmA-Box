'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DateStepper from '@/components/DateStepper';

type RosterItem = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  email: string;
  list_type: 'main' | 'wait';
  attended: boolean;
  attended_at: string | null;
};

type SlotMeta = {
  id: string;
  date: string;
  time: string;
  title: string;
  capacity_main: number;
  capacity_wait: number;
};

type ScheduleItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  capacity_main: number;
  capacity_wait: number;
  booked_main?: number;
  booked_wait?: number;
};

export default function AttendancePage() {
  const { slotId } = useParams<{ slotId: string }>();
  const router = useRouter();

  // Core
  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<SlotMeta | null>(null);
  const [stats, setStats] = useState<{ booked_main: number; booked_wait: number }>({ booked_main: 0, booked_wait: 0 });
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  // Date & classes
  const [date, setDate] = useState<string>('');
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [classes, setClasses] = useState<ScheduleItem[]>([]);

  // Add attendance (live search)
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; first_name: string; last_name: string; email: string; credits: number | null }>>([]);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const classSubtitle = useMemo(() => {
    if (!slot) return '';
    const time = (slot.time || '').slice(0, 5);
    return `${time} • ${slot.title} • Booked ${stats.booked_main}/${slot.capacity_main} · WL ${stats.booked_wait}/${slot.capacity_wait}`;
  }, [slot, stats]);

  // Load current slot + roster
  async function loadSlotAndRoster(sid: string) {
    setLoading(true);
    try {
      const r = await fetch(`/api/attendance?slotId=${sid}`, { cache: 'no-store' });
      const raw = await r.text();
      const j = raw ? JSON.parse(raw) : {};
      if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);

      setSlot(j.slot);
      setStats(j.stats ?? { booked_main: 0, booked_wait: 0 });
      setRoster(j.roster ?? []);
      if (!date && j.slot?.date) setDate(j.slot.date);
    } catch (e: any) {
      alert(e?.message || 'Failed to load attendance');
      router.push('/schedule');
    } finally {
      setLoading(false);
    }
  }

  // Load all classes for date
  async function loadClassesForDate(iso: string) {
    if (!iso) return;
    setLoadingClasses(true);
    try {
      const r = await fetch(`/api/schedule?date=${iso}`, { cache: 'no-store' });
      const raw = await r.text();
      const j = raw ? JSON.parse(raw) : {};
      if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);
      const items: ScheduleItem[] = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
      setClasses(items);
    } catch {
      setClasses([]);
    } finally {
      setLoadingClasses(false);
    }
  }

  useEffect(() => { loadSlotAndRoster(slotId); /* eslint-disable-line */ }, [slotId]);
  useEffect(() => { if (date) loadClassesForDate(date); }, [date]);

  // Actions
  async function toggle(athleteId: string, next: boolean) {
    try {
      setBusy(athleteId);
      const r = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', slotId, athleteId, attended: next }),
      });
      const raw = await r.text();
      const j = raw ? JSON.parse(raw) : {};
      if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);
      await loadSlotAndRoster(slotId);
      window.dispatchEvent(new CustomEvent('credits:refresh'));
    } catch (e: any) {
      alert(e?.message || 'Failed to update attendance');
    } finally {
      setBusy(null);
    }
  }

  async function addWalkin(athleteId: string) {
    try {
      setBusy(athleteId);
      const r = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'add', slotId, athleteId }),
      });
      const raw = await r.text();
      const j = raw ? JSON.parse(raw) : {};
      if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);
      await loadSlotAndRoster(slotId);
      window.dispatchEvent(new CustomEvent('credits:refresh'));
      setAdding(false);
      setQ('');
      setResults([]);
    } catch (e: any) {
      alert(e?.message || 'Failed to add attendance');
    } finally {
      setBusy(null);
    }
  }

  // Live search (debounced)
  useEffect(() => {
    if (!adding) return;
    const run = async () => {
      const query = q.trim();
      if (!query) { setResults([]); return; }
      try {
        setSearching(true);
        const r = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'search', slotId, q: query }),
        });
        const raw = await r.text();
        const j = raw ? JSON.parse(raw) : {};
        if (r.ok) setResults(j.results ?? []);
      } finally {
        setSearching(false);
      }
    };
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(run, 300); // 300ms debounce
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [q, adding, slotId]);



  return (
    <section className="max-w-5xl mx-auto p-3">
      {/* Header row */}
      <header className="mb-3">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">Attendance</h1>
            {/* DateStepper on the left under the title */}
            <div className="mt-2">
              {/* @ts-ignore */}
              <DateStepper
                value={date || (slot?.date ?? new Date().toISOString().slice(0,10))}
                onChange={(v: string) => setDate(v)}
              />
            </div>
          </div>
          <button
            onClick={() => router.push('/schedule')}
            className="px-2 py-1 rounded-md border border-zinc-700 hover:border-emerald-500 hover:bg-emerald-950/40 text-[12px]"
          >
            Back to Schedule
          </button>
        </div>

{/* Class selector (simple dropdown) */}
<div className="mt-3">
  <label className="block text-[15px] text-zinc-400 mb-1">Class</label>
  {loadingClasses ? (
    <div className="text-xs text-zinc-500">Loading classes…</div>
  ) : classes.length === 0 ? (
    <div className="text-xs text-zinc-500">No classes for this day.</div>
  ) : (
    <select
      value={slot?.id ?? ''}
      onChange={(e) => {
        const nextId = e.target.value;
        if (nextId) router.push(`/schedule/attendance/${nextId}`);
      }}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-sm outline-none focus:border-emerald-600"
    >
      {classes.map((c) => (
        <option key={c.id} value={c.id}>
          {(c.time || '').slice(0, 5)} ({c.booked_main ?? 0}/{c.capacity_main})
        </option>
      ))}
    </select>
  )}
</div>


        {/* Subtitle */}
        <div className="mt-2 text-sm text-zinc-400">
          {slot ? classSubtitle : 'Loading…'}
        </div>
      </header>

      {/* Roster + controls */}
      {loading ? (
        <div className="py-8 text-sm text-zinc-400">Loading roster…</div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
            <div className="text-[12px] uppercase tracking-wide text-zinc-400 mb-1">Booked</div>
            <div className="divide-y divide-zinc-800">
              {roster.length === 0 && (
                <div className="text-xs text-zinc-500 py-2">No participants yet.</div>
              )}
              {roster.map((r) => (
                <label
                  key={r.athlete_id}
                  className="flex items-center justify-between py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-500"
                      checked={!!r.attended}
                      disabled={busy === r.athlete_id}
                      onChange={(e) => toggle(r.athlete_id, e.currentTarget.checked)}
                    />
                    <div className="text-sm">
                      <span className="font-medium">
                        {[r.first_name, r.last_name].filter(Boolean).join(' ') || r.email}
                      </span>
                      <span className="ml-2 text-[11px] text-zinc-500">
                        {r.list_type === 'main' ? 'MAIN' : 'WAIT'}
                        {r.attended_at ? ` · ${new Date(r.attended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    </div>
                  </div>
                  {busy === r.athlete_id && (
                    <span className="text-[11px] text-zinc-500">Saving…</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-3">
            {!adding ? (
              <button
                className="px-2.5 py-1.5 rounded-md border border-zinc-700 hover:border-emerald-500 hover:bg-emerald-950/40 text-[12px]"
                onClick={() => setAdding(true)}
              >
                + Add attendance
              </button>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                <div className="flex items-center gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search athlete by name or email…"
                    className="flex-1 bg-transparent border border-zinc-800 rounded-md px-2 py-1 text-sm outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={() => { setAdding(false); setQ(''); setResults([]); }}
                    className="px-2 py-1 rounded-md border border-zinc-700 hover:bg-zinc-900 text-[12px]"
                  >
                    Close
                  </button>
                </div>

                {/* Live results */}
                {q.trim().length > 0 && (
                  <>
                    {searching && <div className="mt-2 text-xs text-zinc-500">Searching…</div>}
                    {!searching && results.length === 0 && (
                      <div className="mt-2 text-xs text-zinc-500">No athletes found.</div>
                    )}
                    {results.length > 0 && (
                      <div className="mt-2 divide-y divide-zinc-800">
                        {results.map((a) => (
                          <div key={a.id} className="flex items-center justify-between py-1.5">
                            <div className="text-sm">
                              <div className="font-medium">
                                {[a.first_name, a.last_name].filter(Boolean).join(' ') || a.email}
                              </div>
                              <div className="text-[11px] text-zinc-500">
                                {a.email} · Credits: {a.credits ?? 0}
                              </div>
                            </div>
                            <button
                              onClick={() => addWalkin(a.id)}
                              disabled={busy === a.id}
                              className="px-2 py-1 rounded-md border border-zinc-700 hover:border-emerald-500 hover:bg-emerald-950/40 text-[12px]"
                            >
                              {busy === a.id ? 'Adding…' : 'Add & mark present'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
