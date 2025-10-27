'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --------------------------------------------------
// Types
// --------------------------------------------------

type Session = {
  role: 'coach' | 'athlete';
  athleteId?: string;
  email?: string;
};

interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  nickname?: string;
  team_name?: string;
  dob: string;
  email: string;
  phone: string;
  is_coach?: boolean;
  height_cm?: number;
  weight_kg?: number;
  years_of_experience?: number;
  credits?: number;
  notes?: string;
  emergency_name?: string;
  emergency_phone?: string;
  created_at: string;
  updated_at: string;
}

// --------------------------------------------------
// Supabase client
// --------------------------------------------------
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --------------------------------------------------
// Component
// --------------------------------------------------

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [q, setQ] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // 1. Get current session (user)
      const { data: s } = await supabase.auth.getSession();
      const user = s.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      // 2. Fetch user profile (role etc.)
      const { data: athleteData } = await supabase
        .from('athletes')
        .select('id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (athleteData) {
        setSession({
          role: athleteData.role === 'coach' ? 'coach' : 'athlete',
          athleteId: athleteData.id,
          email: user.email ?? undefined,
        });
      }

      // 3. Fetch all athletes (for coach) or only self (for athlete)
      const query = supabase
        .from('athletes')
        .select('*')
        .order('last_name', { ascending: true });

      if (athleteData?.role !== 'coach') {
        query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) console.error(error);
      setAthletes(data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const isCoach = session?.role === 'coach';
  const myAthleteId = session?.athleteId;

  // simple search by name / nickname / team
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return athletes;
    return athletes.filter((a) => {
      const full = `${a.first_name} ${a.last_name}`.toLowerCase();
      return (
        full.includes(needle) ||
        (a.nickname?.toLowerCase() ?? '').includes(needle) ||
        (a.team_name?.toLowerCase() ?? '').includes(needle)
      );
    });
  }, [q, athletes]);

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
        Loading athletes…
      </div>
    );
  }

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

      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name / nickname / team"
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm field-muted
                     focus:ring-2 focus:ring-zinc-700/50 focus:outline-none shadow-sm"
        />
        <Link
          href="/athletes/add"
          className="ml-auto px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800 text-sm"
        >
          + Add athlete
        </Link>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400">
          No athletes found.
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const canEditThis = isCoach || (session?.role === 'athlete' && myAthleteId === a.id);
            const itemContent = (
              <div className="flex items-center justify-between gap-3">
                <div className="space-x-2">
                  <span className="font-medium">{a.first_name} {a.last_name}</span>
                  {a.nickname ? <span className="text-zinc-400">({a.nickname})</span> : null}
                  {a.team_name ? <span className="text-zinc-400">[{a.team_name}]</span> : null}
                  {a.is_coach ? (
                    <span className="ml-1 rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Coach</span>
                  ) : null}
                </div>
                {isCoach && (
                  <>
                    <div className="text-sm text-zinc-400">
                      {a.email} • {a.phone}
                    </div>
                    <div className="text-xs text-zinc-500">{a.dob}</div>
                  </>
                )}
              </div>
            );

            return (
              <li key={a.id} className="rounded border border-zinc-800 p-3">
                {canEditThis ? (
                  <Link href={`/athletes/add?id=${a.id}`}>{itemContent}</Link>
                ) : (
                  itemContent
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
