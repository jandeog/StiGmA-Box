'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DateStepper from '@/components/DateStepper';

type Slot = {
  id: string;
  date: string;
  time: string;
  title: string;
  capacity_main: number;
  capacity_wait: number;

  booked_main?: number;
  booked_wait?: number;
  main_names?: string | null;
  wait_names?: string | null;
  flags?: {
    withinWindow?: boolean;
    hasMainSpace?: boolean;
    canBookMain?: boolean;
    canWait?: boolean;
    isMine?: boolean;
    canCancel?: boolean;
  };
  me?: { id: string; credits?: number };
  meBooked?: boolean;
};

type Me = {
  aid?: string;            // preferred
  id?: string;             // fallback
  first_name?: string | null;
  last_name?: string | null;
  is_coach?: boolean;
  credits?: number;        // optional if your /api/schedule already returns me.credits
};

export default function SchedulePage() {
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [isCoach, setIsCoach] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  // NEW: keep minimal info about me for optimistic UI
  const [me, setMe] = useState<Me | null>(null);

  // NEW: local optimistic overlays per slotId
  const [localMyStatus, setLocalMyStatus] = useState<Record<string, 'main' | 'wait' | null>>({});
  const [localCounts, setLocalCounts] = useState<Record<string, { main?: number; wait?: number }>>({});
  const [localNames, setLocalNames] = useState<Record<string, { main?: string[]; wait?: string[] }>>({});
  const [localCreditsDelta, setLocalCreditsDelta] = useState<number>(0); // negative when we book main, +1 when refunded

  const myDisplayName = useMemo(() => {
    const fn = (me?.first_name ?? '').trim();
    const ln = (me?.last_name ?? '').trim();
    return [fn, ln].filter(Boolean).join(' ') || (me?.id ?? me?.aid ?? 'Me');
  }, [me]);

  // ———————————————————————————————————————————————————————————
  const diffHours = (from: Date, to: Date) => (+to - +from) / 36e5;

  async function postJSON<T = any>(url: string, body: any) {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
    const raw = await r.text();
    let j: any = {};
    try { j = raw ? JSON.parse(raw) : {}; } catch { j = {}; }
    if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
    return j as T;
  }

  // Compute per-slot flags on the client if API didn't provide them.
  function computeFlags(s: Slot, dayHasMine: boolean) {
    const sf = s.flags ?? {};

    // If server already gives flags, just respect them (but still apply local override)
    if (
      typeof sf.canBookMain === 'boolean' ||
      typeof sf.canWait === 'boolean' ||
      typeof sf.isMine === 'boolean' ||
      typeof sf.canCancel === 'boolean'
    ) {
      const isMineLocal = localMyStatus[s.id] ? true : sf.isMine;
      return {
        withinWindow: !!sf.withinWindow,
        hasMainSpace: !!sf.hasMainSpace,
        canBookMain: !!sf.canBookMain && !localMyStatus[s.id],
        canWait: !!sf.canWait && !localMyStatus[s.id],
        isMine: !!isMineLocal,
        canCancel: !!sf.canCancel || !!localMyStatus[s.id],
        disabledBecauseOther: (dayHasMine || hasAnyLocalMine()) && !isMineLocal,
      };
    }

    // Otherwise derive locally
    const now = new Date();
    const start = new Date(`${s.date}T${(s.time || '00:00').slice(0, 5)}:00+02:00`);
    const h = diffHours(now, start);

    const withinWindow = h <= 23 && h >= 1;
    const bookedMain = effectiveBookedMain(s);
    const hasMainSpace = bookedMain < (s.capacity_main ?? 0);

    // isMine: server hint or local override
    const isMine = !!s.meBooked || !!sf.isMine || !!localMyStatus[s.id];
    const disabledBecauseOther = (dayHasMine || hasAnyLocalMine()) && !isMine;

    // credits: prefer server, else infer from me + localCreditsDelta
    const credits = s.me?.credits ?? ((me?.credits ?? 1) + localCreditsDelta);

    const canBookMain = withinWindow && hasMainSpace && !disabledBecauseOther && !isMine && credits > 0;
    const canWait = withinWindow && !hasMainSpace && !disabledBecauseOther && !isMine;
    const canCancel = isMine && h >= 2;

    return { withinWindow, hasMainSpace, canBookMain, canWait, isMine, canCancel, disabledBecauseOther };
  }
  // ———————————————————————————————————————————————————————————

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // 1) Who am I
        const meRes = await fetch('/api/me', { cache: 'no-store' });
        const meJ = await meRes.json();
        if (!meRes.ok || !meJ?.me) {
          console.warn('No session, redirecting...');
          window.location.href = '/';
          return;
        }

        // normalize
        const m: Me = {
          aid: meJ.me.aid ?? meJ.me.athlete_id ?? meJ.me.id,
          id: meJ.me.id ?? meJ.me.aid,
          first_name: meJ.me.first_name ?? null,
          last_name: meJ.me.last_name ?? null,
          is_coach: !!meJ.me.is_coach,
          credits: meJ.me.credits ?? undefined,
        };
        if (alive) {
          setMe(m);
          setIsCoach(!!m.is_coach);
          setOk(true);
        }

        // 2) Fetch schedule for this date
        const r = await fetch(`/api/schedule?date=${date}`, { cache: 'no-store' });
        const raw = await r.text();
        let j: any = {};
        try { j = raw ? JSON.parse(raw) : {}; } catch { j = {}; }
        if (!r.ok) throw new Error(j?.error || `Failed to load schedule (HTTP ${r.status})`);

        const items: Slot[] = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
        if (alive) setSlots(items);
      } catch (err) {
        console.error('💥 Schedule load failed', err);
        if (alive) setSlots([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const serverDayHasMine =
    slots.some(s => s.flags?.isMine) ||
    slots.some(s => s.meBooked);

  const localDayHasMine = useMemo(() => hasAnyLocalMine(), [localMyStatus]);
  const dayHasMine = serverDayHasMine || localDayHasMine;

  function hasAnyLocalMine() {
    return Object.values(localMyStatus).some(Boolean);
  }

  function effectiveBookedMain(s: Slot) {
    const base = typeof s.booked_main === 'number' ? s.booked_main : 0;
    const overlay = localCounts[s.id]?.main ?? 0;
    return base + overlay;
  }
  function effectiveBookedWait(s: Slot) {
    const base = typeof s.booked_wait === 'number' ? s.booked_wait : 0;
    const overlay = localCounts[s.id]?.wait ?? 0;
    return base + overlay;
  }
  function effectiveMainNames(s: Slot) {
    const base = s.main_names ? s.main_names.split(',').map(v => v.trim()).filter(Boolean) : [];
    const overlay = localNames[s.id]?.main ?? [];
    // avoid duplicates
    const set = new Set([...base, ...overlay]);
    return Array.from(set).join(', ');
  }

  async function refresh() {
    const r = await fetch(`/api/schedule?date=${date}`, { cache: 'no-store' });
    const raw = await r.text();
    let j: any = {};
    try { j = raw ? JSON.parse(raw) : {}; } catch { j = {}; }
    const items: Slot[] = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
    setSlots(items);
    // Clear optimistic overlays after server confirms (you can keep them if your API doesn’t send aggregates)
    setLocalCounts({});
    setLocalNames({});
    setLocalMyStatus({});
    setLocalCreditsDelta(0);
  }

  if (!ok) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
        Loading schedule…
      </div>
    );
  }

  return (
    <section className="max-w-4xl mx-auto p-3">
<header className="flex items-center justify-center mb-3 gap-x-6 relative">
  <h1 className="text-xl font-semibold absolute left-0">Schedule</h1>

  {/* @ts-ignore */}
  <DateStepper
    value={date}
    onChange={(v: string) => {
      setLoading(true);
      setDate(v);
    }}
  />

  {isCoach ? (
    <Link
      href="/schedule/edit"
      prefetch={false}
      className="absolute right-0 px-2.5 py-1.5 rounded-md border border-zinc-700 hover:border-emerald-500 hover:bg-emerald-950/40 text-[13px]"
    >
      Edit Schedule
    </Link>
  ) : null}
</header>

      {loading && (
        <div className="flex items-center justify-center py-10 text-zinc-400 text-sm space-x-2">
          <svg className="animate-spin h-5 w-5 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
          <span className="text-emerald-400 font-semibold">Loading classes…</span>
        </div>
      )}

      {!loading && slots.length === 0 && (
        <div className="text-xs text-zinc-400">No classes for this day.</div>
      )}

      {!loading && slots.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {slots.map((s) => {
            const f = computeFlags(s, dayHasMine);

            const label = f.isMine
              ? (f.canCancel ? 'Cancel booking' : 'Booked')
              : f.canBookMain
                ? 'Book now'
                : f.canWait
                  ? 'Join waitlist'
                  : 'Unavailable';

            const disabled =
              f.disabledBecauseOther ||
              (!f.isMine && !f.canBookMain && !f.canWait) ||
              busyId === s.id;

// add this helper just above btnClass (still inside slots.map):
const isCancel = f.isMine && f.canCancel;

// replace the existing btnClass with:
const btnClass =
  'px-2 py-[2px] rounded-md border text-[12px] leading-none appearance-none min-h-0 h-auto ' +
  (isCancel
    ? 'border-red-600 text-red-300 hover:bg-red-950/30'
    : f.isMine
      ? 'border-emerald-600 text-emerald-300'
      : f.canBookMain
        ? 'border-emerald-700 text-emerald-300 hover:bg-emerald-950/30'
        : f.canWait
          ? 'border-zinc-600 text-zinc-300 hover:bg-zinc-900/50'
          : 'border-zinc-700 text-zinc-500 opacity-50 cursor-not-allowed');

            const onClick = async () => {
              try {
                if (disabled) return;
                setBusyId(s.id);

                if (f.isMine && f.canCancel) {
                  await postJSON('/api/schedule/cancel', { slotId: s.id });

                  // optimistic: remove my status and counts/names
                  setLocalMyStatus(prev => ({ ...prev, [s.id]: null }));
                  setLocalNames(prev => {
                    const arr = (prev[s.id]?.main ?? []).filter(n => n !== myDisplayName);
                    return { ...prev, [s.id]: { ...(prev[s.id] || {}), main: arr } };
                  });
                  // if we had moved to main, refund credit (server may or may not, depending on time)
                  // we won’t adjust credits here; server refresh will reset.
                  setLocalCounts(prev => {
                    const adj = { ...prev[s.id] };
                    if ((localMyStatus[s.id] ?? 'main') === 'main') {
                      adj.main = (adj.main ?? 0) - 1;
                    } else if ((localMyStatus[s.id] ?? 'wait') === 'wait') {
                      adj.wait = (adj.wait ?? 0) - 1;
                    }
                    return { ...prev, [s.id]: adj };
                  });
                } else if (!f.isMine && f.canBookMain) {
                  const res = await postJSON('/api/schedule/book', { slotId: s.id });

                  // optimistic: mark me as main
                  setLocalMyStatus(prev => ({ ...prev, [s.id]: 'main' }));
                  setLocalNames(prev => {
                    const arr = Array.from(new Set([...(prev[s.id]?.main ?? []), myDisplayName]));
                    return { ...prev, [s.id]: { ...(prev[s.id] || {}), main: arr } };
                  });
                  setLocalCounts(prev => ({
                    ...prev,
                    [s.id]: { ...(prev[s.id] || {}), main: ((prev[s.id]?.main ?? 0) + 1) },
                  }));
                  // optimistic credit decrement for MAIN
                  setLocalCreditsDelta(v => v - 1);
                } else if (!f.isMine && f.canWait) {
                  const ok = window.confirm('Class is full. Join the waiting list?');
                  if (!ok) return;

                  const res = await postJSON('/api/schedule/book', { slotId: s.id, joinWaitIfFull: true });

                  // optimistic: mark me as wait
                  setLocalMyStatus(prev => ({ ...prev, [s.id]: 'wait' }));
                  setLocalCounts(prev => ({
                    ...prev,
                    [s.id]: { ...(prev[s.id] || {}), wait: ((prev[s.id]?.wait ?? 0) + 1) },
                  }));
                  // names list usually shows MAIN only; we leave it unchanged
                }

                // Always refresh after the optimistic update
                await refresh();
              } catch (e: any) {
                alert(e?.message || 'Action failed');
              } finally {
                setBusyId(null);
              }
            };

            const showBookedLine = (
              typeof s.booked_main === 'number' ||
              typeof s.booked_wait === 'number' ||
              localCounts[s.id]?.main !== undefined ||
              localCounts[s.id]?.wait !== undefined ||
              s.main_names ||
              (localNames[s.id]?.main?.length ?? 0) > 0
            );

            const bookedMainEff = effectiveBookedMain(s);
            const bookedWaitEff = effectiveBookedWait(s);
            const mainNamesEff = effectiveMainNames(s);

            return (
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

                {/* live counts + names (fallback to optimistic overlays if server doesn't send them) */}
                {showBookedLine && (
                  <div className="mt-1 text-[11px] text-zinc-500">
                    <span>
                      Booked {bookedMainEff}/{s.capacity_main}
                      {typeof bookedWaitEff === 'number' ? ` · WL ${bookedWaitEff}/${s.capacity_wait}` : null}
                    </span>
                    {mainNamesEff ? <div className="truncate">{mainNamesEff}</div> : null}
                  </div>
                )}

                <div className="mt-2 flex justify-end">
                  <button
                    className={btnClass}
                    disabled={disabled}
                    onClick={onClick}
                  >
                    {busyId === s.id ? 'Working…' : label}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
