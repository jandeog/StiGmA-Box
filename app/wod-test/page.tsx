// app/wod-test/page.tsx
'use client';

import { useState } from 'react';

type Wod = {
  id: string;
  date: string;
  title: string;
  description: string;
  scoring: string;
  timeCap?: string | null;
};

export default function WodTestPage() {
  const [rows, setRows] = useState<Wod[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const load = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/wod', { cache: 'no-store' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed');
      setRows(j.data);
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const createOne = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/wod', { method: 'POST' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Failed');
      setMsg('Inserted!');
      await load();
    } catch (e: any) {
      setMsg(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">WOD DB Test</h1>

      <div className="flex gap-2 mb-4">
        <button
          onClick={createOne}
          disabled={busy}
          className="px-3 py-2 rounded border border-emerald-600 text-emerald-300 hover:bg-emerald-900/20 disabled:opacity-50"
        >
          Create sample WOD
        </button>
        <button
          onClick={load}
          disabled={busy}
          className="px-3 py-2 rounded border border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
        >
          Load last 10
        </button>
      </div>

      {msg ? (
        <div className="mb-3 text-sm text-amber-300">{msg}</div>
      ) : null}

      {rows?.length ? (
        <div className="space-y-2">
          {rows.map((w) => (
            <div key={w.id} className="rounded border border-zinc-800 p-3">
              <div className="text-sm text-zinc-400">
                {new Date(w.date).toISOString().slice(0, 10)}
              </div>
              <div className="font-medium">{w.title}</div>
              <div className="text-sm text-zinc-300">{w.description}</div>
              <div className="text-xs text-zinc-500">
                scoring: {w.scoring} {w.timeCap ? `• cap ${w.timeCap}` : ''}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-zinc-400">No data yet.</div>
      )}
    </section>
  );
}
