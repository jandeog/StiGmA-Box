// app/athletes/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Session = {
  role: 'coach' | 'athlete';
  athleteId?: string;
  email?: string;
};

const KEY_AUTH = 'auth:user';

type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  teamName?: string;
  dob: string;
  email: string;
  phone: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_say';
  heightCm?: number;
  weightKg?: number;
  yearsOfExperience?: number;
  credits?: number;
  notes?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  createdAt: string;
  updatedAt: string;
};

const keyAthletes = 'athletes';

export default function AthletesPage() {
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [q, setQ] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(keyAthletes);
    setAthletes(raw ? (JSON.parse(raw) as Athlete[]) : []);

    const s = localStorage.getItem(KEY_AUTH);
    setSession(s ? (JSON.parse(s) as Session) : null);
  }, []);
  const isCoach = session?.role === 'coach';
  const myAthleteId = session?.athleteId;


  // simple search by name / nickname / team
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return athletes;
    return athletes.filter(a => {
      const full = `${a.firstName} ${a.lastName}`.toLowerCase();
      return (
        full.includes(needle) ||
        (a.nickname?.toLowerCase() || '').includes(needle) ||
        (a.teamName?.toLowerCase() || '').includes(needle)
      );
    });
  }, [q, athletes]);

  return (
    <section className="max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Athletes</h1>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name / nickname / team"
            className="w-64 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          />
          <Link
            href="/athletes/add"
            className="px-3 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
          >
            + Add athlete
          </Link>
        </div>
      </div>

      <div className="text-sm text-zinc-400 mb-3">
        Total: {athletes.length} {athletes.length === 1 ? 'athlete' : 'athletes'}
      </div>

      <div className="border border-zinc-800 rounded overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-zinc-400">No athletes found.</div>
        ) : (
          <ul className="divide-y divide-zinc-800">
{filtered.map((a) => {
  const canEditThis =
    isCoach || (session?.role === 'athlete' && myAthleteId === a.id);

  const itemContent = (
    <div className="p-3 flex items-center gap-3">
      <div className="flex-1">
        <div className="font-medium">
          {a.firstName} {a.lastName}
          {a.nickname ? <span className="text-zinc-400"> ({a.nickname})</span> : null}
          {a.teamName ? <span className="text-zinc-500 text-xs ml-2">[{a.teamName}]</span> : null}
        </div>

        {/* coach βλέπει email+phone, αλλιώς όχι */}
        {isCoach ? (
          <div className="text-xs text-zinc-500">
            {a.email} • {a.phone}
          </div>
        ) : null}
      </div>

      {/* Προαιρετικά κάτι δεξιά, π.χ. DOB για coach μόνο */}
      {isCoach ? <div className="text-xs text-zinc-500">{a.dob}</div> : null}
    </div>
  );

  return (
    <li key={a.id} className="border-b border-zinc-800">
      {canEditThis ? (
        <Link href={`/athletes/add?id=${a.id}`} className="block hover:bg-zinc-800/40">
          {itemContent}
        </Link>
      ) : (
        itemContent
      )}
    </li>
  );
})}

          </ul>
        )}
      </div>

      <p className="text-xs text-zinc-500 mt-3">
        Use “+ Add athlete” to add a new entry. Records are stored locally for the demo.
      </p>
    </section>
  );
}
