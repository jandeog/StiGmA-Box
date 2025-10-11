// app/athletes/page.tsx 'use client';

import Link from 'next/link'; import { useEffect, useMemo, useState } from 'react';

type Session = { role: 'coach' | 'athlete'; athleteId?: string; email?: string; };

const KEY_AUTH = 'auth:user';

type Athlete = { id: string; firstName: string; lastName: string; nickname?: string; teamName?: string; dob: string; email: string; phone: string; isCoach?: boolean; // gender?: 'male' | 'female' | 'other' | 'prefer_not_say'; heightCm?: number; weightKg?: number; yearsOfExperience?: number; credits?: number; notes?: string; emergencyName?: string; emergencyPhone?: string; createdAt: string; updatedAt: string; };

const keyAthletes = 'athletes';

export default function AthletesPage() { const [athletes, setAthletes] = useState<Athlete[]>([]); const [q, setQ] = useState(''); const [session, setSession] = useState<Session | null>(null);

useEffect(() => { const raw = localStorage.getItem(keyAthletes); setAthletes(raw ? (JSON.parse(raw) as Athlete[]) : []);

const s = localStorage.getItem(KEY_AUTH);
setSession(s ? (JSON.parse(s) as Session) : null);

}, []);

const isCoach = session?.role === 'coach'; const myAthleteId = session?.athleteId;

// simple search by name / nickname / team const filtered = useMemo(() => { const needle = q.trim().toLowerCase(); if (!needle) return athletes; return athletes.filter((a) => { const full = ${a.firstName} ${a.lastName}.toLowerCase(); return ( full.includes(needle) || (a.nickname?.toLowerCase() || '').includes(needle) || (a.teamName?.toLowerCase() || '').includes(needle) ); }); }, [q, athletes]);

return ( <div className="space-y-4"> {/* Row 1: Title + total on the right */} <div className="flex items-end justify-between gap-3"> <h1 className="text-3xl font-bold tracking-tight">Athletes</h1> <div className="text-sm text-zinc-400"> Total: {athletes.length} {athletes.length === 1 ? 'athlete' : 'athletes'} </div> </div>

{/* Row 2: Controls (search, actions) */}
  <div className="flex flex-wrap items-center gap-2">
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search by name / nickname / team"
      className="w-64 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
    />

    {isCoach && (
      <>
        {/* Export */}
        <button
          onClick={() => {
            const exportPrefixes = ['athletes', 'schedule:', 'wod:', 'scores:'];
            const dump: Record<string, string> = {};
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k) continue;
              if (exportPrefixes.some((p) => k.startsWith(p))) {
                const v = localStorage.getItem(k);
                if (v !== null) dump[k] = v;
              }
            }
            const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'wodbox-backup.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
        >
          Export
        </button>

        {/* Import */}
        <button
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                const dump = JSON.parse(text) as Record<string, string>;
                Object.entries(dump).forEach(([k, v]) => localStorage.setItem(k, v));
                window.dispatchEvent(new Event('athletes:changed'));
                window.dispatchEvent(new Event('auth:changed'));
                alert('Import successful!');
              } catch (e) {
                alert('Invalid JSON');
              }
            };
            input.click();
          }}
          className="px-2 py-1 rounded border border-zinc-700 hover:bg-zinc-800 text-xs"
        >
          Import
        </button>
      </>
    )}

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
              <span className="font-medium">{a.firstName} {a.lastName}</span>
              {a.nickname ? <span className="text-zinc-400">({a.nickname})</span> : null}
              {a.teamName ? <span className="text-zinc-400">[{a.teamName}]</span> : null}
              {a.isCoach ? (
                <span className="ml-1 rounded bg-zinc-700/60 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Coach</span>
              ) : null}
            </div>

            {/* coach βλέπει email+phone, αλλιώς όχι */}
            {isCoach ? (
              <div className="text-sm text-zinc-400">
                {a.email} • {a.phone}
              </div>
            ) : null}

            {/* Προαιρετικά κάτι δεξιά, π.χ. DOB για coach μόνο */}
            {isCoach ? <div className="text-xs text-zinc-500">{a.dob}</div> : null}
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

  <p className="text-xs text-zinc-500">
    Use “+ Add athlete” to add a new entry. Records are stored locally for the demo.
  </p>
</div>

); }

