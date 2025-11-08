'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

const supabase = getSupabaseBrowser();

type Slot = {
  id?: string;
  day_of_week?: number;
  date?: string;
  time: string;
  title: string;
  capacity_main: number;
  capacity_wait: number;
  enabled: boolean;
};

const daysMap = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export default function ScheduleEditPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'template' | 'specific'>('template');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dow, setDow] = useState(1);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // 🧩 Load schedule via API (uses service key)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg('');

      try {
        console.log('Fetching mode:', mode, mode === 'template' ? dow : date);

        if (mode === 'template') {
          // Για το template (θα το αλλάξουμε αργότερα για admin edit)
          const res = await fetch(`/api/schedule?date=${date}`, { credentials: 'include' });
          const { items, msg, error } = await res.json();
          if (error) throw new Error(error);
          console.log('✅ Loaded via API:', msg);
          setSlots(items || []);
        } else {
          // Για specific date
          const res = await fetch(`/api/schedule?date=${date}`, { credentials: 'include' });
          const { items, msg, error } = await res.json();
          if (error) throw new Error(error);
          console.log('✅ Loaded via API:', msg);
          setSlots(items || []);
        }
      } catch (err) {
        console.error('💥 Schedule load error:', err);
        setMsg('❌ Error loading data');
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, dow, date]);

  // 🔧 Handlers
  function updateSlot(index: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    setSlots((prev) => [
      ...prev,
      { time: '07:00', title: 'Class', capacity_main: 14, capacity_wait: 2, enabled: true },
    ]);
  }

  function removeSlot(index: number) {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleApply() {
    setSaving(true);
    setMsg('');

    try {
      // Για τώρα απλώς δείχνουμε success (το save API θα προστεθεί αργότερα)
      await new Promise((res) => setTimeout(res, 500));
      setMsg('✅ Schedule saved successfully (placeholder)');
    } catch (err) {
      console.error(err);
      setMsg('❌ Error saving changes');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  }

  function handleCancel() {
    router.push('/schedule');
  }

  return (
    <section className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold mb-2">Change Schedule</h1>

      {/* Mode Selection */}
      <div className="flex items-center gap-6 mb-4">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'template'} onChange={() => setMode('template')} />
          <span>Change Main Schedule</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === 'specific'} onChange={() => setMode('specific')} />
          <span>Change Specific Date</span>
        </label>
      </div>

      {/* Template mode */}
      {mode === 'template' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Day of week:</span>
            <select
              value={dow}
              onChange={(e) => setDow(Number(e.target.value))}
              className="px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
            >
              {daysMap.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Specific date mode */}
      {mode === 'specific' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">Select date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
            />
          </div>
        </div>
      )}

      {/* Data display */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-zinc-400 text-sm space-x-2">
          <svg
            className="animate-spin h-5 w-5 text-emerald-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            ></path>
          </svg>
          <span>Loading schedule data…</span>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950">
            {slots.map((s, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 p-2 border-b border-zinc-900 items-center"
              >
                <div className="col-span-1 text-xs text-zinc-400">#{idx + 1}</div>
                <div className="col-span-2">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => updateSlot(idx, { enabled: e.target.checked })}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    value={s.time}
                    onChange={(e) => updateSlot(idx, { time: e.target.value })}
                    className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
                  />
                </div>
                <div className="col-span-3">
                  <select
                    value={s.title}
                    onChange={(e) => updateSlot(idx, { title: e.target.value })}
                    className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
                  >
                    <option value="Class">Class</option>
                    <option value="Competitive">Competitive</option>
                    <option value="Teams">Teams</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    value={s.capacity_main}
                    onChange={(e) => updateSlot(idx, { capacity_main: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input
                    type="number"
                    value={s.capacity_wait}
                    onChange={(e) => updateSlot(idx, { capacity_wait: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
                  />
                  <button
                    onClick={() => removeSlot(idx)}
                    className="px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="p-2">
              <button
                onClick={addSlot}
                className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
              >
                + Add slot
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleApply}
              disabled={saving}
              className="px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm flex items-center gap-2"
            >
              {saving && (
                <svg
                  className="animate-spin h-4 w-4 text-emerald-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
              )}
              Apply
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm"
            >
              Cancel
            </button>
            {msg && <div className="text-sm text-zinc-400">{msg}</div>}
          </div>
        </>
      )}
    </section>
  );
}
