'use client';

import Link from 'next/link';
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
  created_at?: string;
  updated_at?: string;
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
        'inline-flex items-center rounded border border-emerald-500/60 bg-emerald-500/10 px-1.5 py-[0px] text-[11px] font-medium text-emerald-300 '
      }
      title="Nickname"
    >
      {value}
    </span>
  );
}

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>('athlete');
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // who am I
        const meRes = await fetch('/api/me', { cache: 'no-store' });
        const meJ = await meRes.json();
        if (meRes.ok && meJ?.me) {
          setRole(meJ.me.is_coach ? 'coach' : 'athlete');
          setMyId(meJ.me.id ?? null);
        }
        // list
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

  // order coaches first, then by last/first
  const ordered = useMemo(() => {
    const cmp = (a?: string | null, b?: string | null) =>
      (a ?? '').localeCompare(b ?? '', undefined, { sensitivity: 'base' });
    const copy = [...athletes];
    copy.sort((a, b) => {
      const coachDiff = (b.is_coach ? 1 : 0) - (a.is_coach ? 1 : 0);
      if (coachDiff !== 0) return coachDiff;
      const ln = cmp(a.last_name, b.last_name);
      if (ln !== 0) return ln;
      return cmp(a.first_name, b.first_name);
    });
    return copy;
  }, [athletes]);

  // search
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

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
        Loading athletes…
      </div>
    );
  }

  const isCoach = role === 'coach';

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

      {/* Search + Add */}
      <div className="flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / nickname / team"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-[13px]
                     focus:ring-2 focus:ring-zinc-700/40 focus:outline-none shadow-sm"
        />
        {isCoach && (
          <Link
            href="/athletes/add?new=1"
            className="ml-auto px-2.5 py-1.5 rounded-md border border-zinc-700 hover:bg-zinc-800 text-[13px]"
          >
            + Add
          </Link>
        )}
      </div>

      {/* Compact list */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-400">
          No athletes found.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((a) => {
            const clickable = isCoach || (myId && a.id === myId);
            const fullName =
              `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;

            const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
              clickable ? (
                <Link
                  href={`/athletes/add?id=${a.id}`}
                  prefetch={false}
                  className="group block"
                  title={isCoach ? 'Edit athlete' : 'Edit your profile'}
                >
                  {children}
                </Link>
              ) : (
                <div className="block" title="Only coaches can edit other athletes">
                  {children}
                </div>
              );

            return (
              <li
                key={a.id}
                className={
                  'rounded border p-2 text-xs ' +
                  (clickable
                    ? 'border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-900/10 transition-colors'
                    : 'border-zinc-800')
                }
              >
<Wrapper>
  {/* Athlete: single line — left = Name + Nickname (+Coach), right = Team */}
  {!isCoach ? (
    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
      <div className="min-w-0 flex items-center gap-1">
        <div className="font-medium truncate">{fullName}</div>
        {a.nickname ? (
          <NicknameBadge
            value={a.nickname}
            className="shrink-0 max-w-[50vw] sm:max-w-[280px] truncate"
          />
        ) : null}
        {a.is_coach ? <CoachBadge /> : null}
      </div>
      <div className="text-[11px] text-zinc-400 truncate justify-self-end">
        {a.team_name ?? ''}
      </div>
    </div>
  ) : (
    /* Coach: line1 left=Name + Nickname + Coach, right=Phone
              line2 left=Team (small), right=Email */
    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
      {/* Line 1 */}
      <div className="min-w-0 flex items-center gap-1">
        <div className="font-medium truncate">{fullName}</div>
        {a.nickname ? (
          <NicknameBadge
            value={a.nickname}
            className="shrink-0 max-w-[40vw] sm:max-w-[220px] truncate"
          />
        ) : null}
        {a.is_coach ? <CoachBadge /> : null}
      </div>
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
      {/* Line 2 */}
      <div className="min-w-0 text-[11px] text-zinc-400 truncate">
        {a.team_name ?? ''}
      </div>
      <a
        href={`mailto:${a.email}`}
        className="text-[11px] hover:underline break-all justify-self-end"
        onClick={(e) => e.stopPropagation()}
      >
        {a.email}
      </a>
    </div>
  )}
</Wrapper>


              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
