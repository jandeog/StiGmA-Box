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
  dob?: string | null;
  email: string;
  phone?: string | null;
  is_coach?: boolean | null;
  created_at: string;
  updated_at: string;
}

/** Small badge used for the Coach tag */
function CoachBadge() {
  return (
    <span
      className="ml-2 inline-flex items-center rounded-md border border-yellow-500/60 bg-yellow-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-300"
      title="Coach"
    >
      Coach
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
        // fetch role & id explicitly
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

  // order: coaches first, then last_name/first_name asc
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

  // search in name / nickname / team
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return ordered;
    return ordered.filter((a) => {
      const full = `${a.first_name ?? ''} ${a.last_name ?? ''}`.toLowerCase();
      return (
        full.includes(needle) ||
        (a.nickname ?? '').toLowerCase().includes(needle) ||
        (a.team_name ?? '').toLowerCase().includes(needle)
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight select-none">
          <span className="inline-block border-b-2 border-zinc-700 pb-1">Athletes</span>
        </h1>
        <div className="text-sm text-zinc-400">
          Total: {athletes.length} {athletes.length === 1 ? 'athlete' : 'athletes'}
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name / nickname / team"
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm
                     focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
        />
        {isCoach && (
          <Link
            href="/athletes/add?new=1"
            className="ml-auto px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800 text-sm"
          >
            + Add athlete
          </Link>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
          No athletes found.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const clickable = isCoach || (myId && a.id === myId);
            const fullName = `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim() || a.email;
            const subtitle = [a.nickname ? `(${a.nickname})` : null, a.team_name ? `[${a.team_name}]` : null]
              .filter(Boolean)
              .join(' ');
  // Clickable if coach OR it's me
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
               <div className="block" title="Only coaches can edit other athletes">{children}</div>
              );


            return (
           <li
  key={a.id}
  className={
    'rounded border p-3 ' +
    (clickable
      
      ? 'border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-900/10 transition-colors'
      : 'border-zinc-800')
  }
>
                <Wrapper>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: name + badges */}
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{fullName}</div>
                      {subtitle ? <div className="text-zinc-400">{subtitle}</div> : null}
                      {a.is_coach ? <CoachBadge /> : null}
                    </div>

                    {/* Right: fields depend on role */}
                    {isCoach ? (
                      <div className="text-sm text-zinc-400 sm:text-right">
                        {a.email}
                        {a.phone ? <span className="opacity-70"> • {a.phone}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </Wrapper>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
