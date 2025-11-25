'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Role = 'coach' | 'athlete';

interface Athlete {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname?: string | null;
  team_name?: string | null;
  email: string;
  phone?: string | null;
  is_coach?: boolean | null;
  credits?: number | null;
  created_at?: string;
  updated_at?: string;
  last_credits_update?: string | null;
}

/** Compact coach badge */
function CoachBadge() {
  return (
    <span
      className="ml-1 inline-flex items-center rounded border border-yellow-500/60 bg-yellow-500/10 py-[0px] px-1 text-[10px] font-semibold uppercase tracking-wide text-yellow-300"
      title="Coach"
    >
      Coach
    </span>
  );
}

/** Compact green nickname badge */
function NicknameBadge({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span
      className={
        'inline-flex items-center rounded border border-emerald-500/60 bg-emerald-500/10 px-1.5 py-[0px] text-[11px] font-medium text-emerald-300 ' +
        className
      }
      title="Nickname"
    >
      {value}
    </span>
  );
}

// NEW — format last credits update
function formatLastCreditsUpdate(v?: string | null) {
  if (!v) return 'Never';
  const dt = new Date(v);
  if (isNaN(dt.getTime())) return 'Never';
  return dt.toLocaleDateString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function AthletesPage() {
  const router = useRouter();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>('athlete');
  const [myId, setMyId] = useState<string | null>(null);

  // Credits mode
  const [creditsMode, setCreditsMode] = useState(false);
  const [creditsDraft, setCreditsDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const meRes = await fetch('/api/me', { cache: 'no-store' });
        const meJ = await meRes.json();
        if (meRes.ok && meJ?.me) {
          setRole(meJ.me.is_coach ? 'coach' : 'athlete');
          setMyId(meJ.me.id ?? null);
        }

        const r = await fetch('/api/athletes', { cache: 'no-store' });
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(j?.error || 'Failed to load athletes');
        setAthletes(j.items ?? []);
      } catch (err) {
        console.error(err);
        setAthletes([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ordered = useMemo(() => {
    const cmp = (a?: string | null, b?: string | null) =>
      (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });
    const copy = [...athletes];
    copy.sort((a, b) => {
      const coachDiff = (b.is_coach ? 1 : 0) - (a.is_coach ? 1 : 0);
      if (coachDiff !== 0) return coachDiff;
      const ln = cmp(a.last_name as any, b.last_name as any);
      if (ln !== 0) return ln;
      return cmp(a.first_name, b.first_name);
    });
    return copy;
  }, [athletes]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter((a) => {
      const full = `${a.first_name ?? ''} ${a.last_name ?? ''}`.toLowerCase();
      return (
        full.includes(needle) ||
        (a.nickname ?? '').toLowerCase().includes(needle) ||
        (a.team_name ?? '').toLowerCase().includes(needle) ||
        (a.email ?? '').toLowerCase().includes(needle)
      );
    });
  }, [q, ordered]);

  const isCoach = role === 'coach';

  function currentCredits(a: Athlete) {
    const base = Number.isFinite(a.credits as any) ? (a.credits as number) : 0;
    return creditsDraft[a.id] ?? base;
  }

  function setCreditsFor(id: string, v: number) {
    setCreditsDraft((prev) => ({ ...prev, [id]: Math.max(0, Math.floor(v || 0)) }));
  }

  async function refreshList() {
    const r = await fetch('/api/athletes', { cache: 'no-store' });
    const j = await r.json();
    if (r.ok) setAthletes(j.items ?? []);
  }

  function enterCreditsMode() {
    const map: Record<string, number> = {};
    for (const a of filtered) {
      map[a.id] = a.credits ?? 0;
    }
    setCreditsDraft(map);
    setCreditsMode(true);
  }

  async function saveCredits() {
    try {
      setSaving(true);
      const byId: Record<string, Athlete> = Object.fromEntries(athletes.map((a) => [a.id, a]));
      const updates = Object.entries(creditsDraft)
        .filter(([id, val]) => (byId[id]?.credits ?? 0) !== val)
        .map(async ([id, val]) => {
          const r = await fetch(`/api/athletes/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credits: val }),
          });
          if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j?.error || 'Failed to update credits');
          }
        });

      await Promise.all(updates);
      await refreshList();
      setCreditsMode(false);
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
        Loading athletes…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight leading-tight select-none">
          <span className="inline-block border-b border-zinc-700 pb-0.5">Athletes</span>
        </h1>
        <div className="text-xs text-zinc-400">
          Total: {athletes.length} {athletes.length === 1 ? 'athlete' : 'athletes'}
        </div>
      </div>

      {/* Search + buttons */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / nickname / team"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-[13px]
                     focus:ring-2 focus:ring-zinc-700/40 focus:outline-none shadow-sm"
        />

        {isCoach && (
          <>
            {!creditsMode ? (
              <button
                type="button"
                onClick={enterCreditsMode}
                className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-[13px] hover:bg-zinc-800"
              >
                Credits
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCreditsMode(false)}
                className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-[13px] hover:bg-zinc-800"
              >
                Cancel
              </button>
            )}

            {!creditsMode ? (
              <Link
                href="/athletes/add?new=1"
                className="inline-flex h-8 items-center rounded-md border border-zinc-700 px-3 text-[13px] hover:bg-zinc-800"
              >
                + Add
              </Link>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={saveCredits}
                className="inline-flex h-8 items-center rounded-md border border-emerald-600 bg-emerald-700/20 px-3 text-[13px] text-emerald-300 hover:bg-emerald-700/30 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Compact list */}
      <ul className="space-y-1.5">
        {filtered.map((a) => {
          const fullName =
            `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
          const clickable = isCoach || (myId && a.id === myId);

          const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
            clickable ? (
              <div
                role="link"
                tabIndex={0}
                onClick={() => router.push(`/athletes/add?id=${a.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') router.push(`/athletes/add?id=${a.id}`);
                }}
                className="group block cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-emerald-600/50"
              >
                {children}
              </div>
            ) : (
              <div>{children}</div>
            );

          return (
            <li
              key={a.id}
              className={
                'rounded border p-2 text-xs ' +
                (clickable
                  ? 'border-zinc-800 hover:border-emerald-500/10 hover:bg-emerald-900/10 transition-colors'
                  : 'border-zinc-800')
              }
            >
              <Wrapper>
                {role !== 'coach' ? (
                  /* Athlete view (no changes) */
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                    <div className="min-w-0 flex items-center gap-1">
                      <div className="font-medium truncate">{fullName}</div>
                      {a.nickname ? <NicknameBadge value={a.nickname} /> : null}
                      {a.is_coach ? <CoachBadge /> : null}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate justify-self-end">
                      {a.team_name ?? ''}
                    </div>
                  </div>
                ) : (
                  /* Coach View */
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">

                    {/* Line 1 */}
                    <div className="min-w-0 flex items-center gap-1">
                      <div className="font-medium truncate">{fullName}</div>
                      {a.nickname ? <NicknameBadge value={a.nickname} /> : null}
                      {a.is_coach ? <CoachBadge /> : null}
                    </div>

                    {!creditsMode ? (
                      <div className="text-[11px] justify-self-end">
                        {a.phone ? (
                          <a
                            href={`tel:${a.phone}`}
                            className="hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {a.phone}
                          </a>
                        ) : (
                          <span className="opacity-60 select-none">No phone</span>
                        )}
                      </div>
                    ) : (
                      <div
                        className="text-[11px] justify-self-end flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="opacity-80">Credits:</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={currentCredits(a)}
                          onChange={(e) =>
                            setCreditsFor(
                              a.id,
                              Math.max(0, Math.floor(Number(e.target.value || 0)))
                            )
                          }
                          onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
                          }}
                          className="w-16 rounded border border-zinc-700 bg-zinc-900/80 px-2 py-1 text-[11px] text-zinc-100"
                        />
                      </div>
                    )}

                    {/* Line 2 (TEAM or LAST RENEWAL) */}
                    <div className="min-w-0 text-[11px] text-zinc-400 truncate">
                      {!creditsMode
                        ? a.team_name ?? ''
                        : `Last credits renewal: ${formatLastCreditsUpdate(a.last_credits_update)}` }
                    </div>

                    {/* Line 2 right side */}
                    {!creditsMode ? (
                      <a
                        href={`mailto:${a.email}`}
                        className="text-[11px] hover:underline break-all justify-self-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {a.email}
                      </a>
                    ) : (
                      <div
                        className="justify-self-end flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {[5, 10, 15, 25].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            className="text-[11px] rounded border border-zinc-700 px-2 py-0.5 hover:bg-zinc-800"
                            onClick={() => setCreditsFor(a.id, currentCredits(a) + amt)}
                          >
                            +{amt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Wrapper>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
