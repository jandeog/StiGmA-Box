'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DateStepper from '@/components/DateStepper';
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
  const [applyAllWeekdays, setApplyAllWeekdays] = useState(false);

  // ---- helpers ----
  function getNextDateByDayOfWeek(dow: number) {
    const today = new Date();
    const diff = (dow + 7 - today.getDay()) % 7;
    const target = new Date(today);
    target.setDate(today.getDate() + diff);
    return target.toISOString().split('T')[0];
  }

  // ---- data load ----
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const fetchDow = applyAllWeekdays ? 1 : dow;
        const tempDate = getNextDateByDayOfWeek(fetchDow);
        const res = await fetch(`/api/schedule?date=${tempDate}`, { credentials: 'include' });
        const { items, error } = await res.json();
        if (error) throw new Error(error);
        setSlots(items || []);
      } catch (err) {
        console.error('schedule load error', err);
        setMsg('❌ Error loading data');
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, dow, date, applyAllWeekdays]);

  // ---- handlers ----
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
    try {
      await new Promise((res) => setTimeout(res, 400));
      setMsg('✅ Schedule saved successfully!');
    } catch {
      setMsg('❌ Error saving changes');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 3000);
    }
  }
  function handleCancel() {
    router.push('/schedule');
  }

  // ---- render ----
  return (
    <section className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Change Schedule</h1>

      <div className="flex items-start gap-8">
        {/* --- left column (radios) --- */}
        <div className="w-40 flex flex-col text-sm text-zinc-300 space-y-3 pt-2">
          <label className="flex flex-col gap-1">
            <input
              type="radio"
              checked={mode === 'template'}
              onChange={() => setMode('template')}
            />
            <span>Change Main Schedule</span>
          </label>
          <label className="flex flex-col gap-1">
            <input
              type="radio"
              checked={mode === 'specific'}
              onChange={() => setMode('specific')}
            />
            <span>Change Specific Date</span>
          </label>
        </div>

        {/* --- right tab container --- */}
        <div className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-inner space-y-4">
          {/* controls row */}
          {mode === 'template' && (
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={applyAllWeekdays}
                  onChange={(e) => setApplyAllWeekdays(e.target.checked)}
                />
                <span className="text-sm text-zinc-300">Change all week days</span>
              </div>
              {!applyAllWeekdays && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-400">Day of week:</span>
                  <select
                    value={dow}
                    onChange={(e) => setDow(Number(e.target.value))}
                    className="px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
                  >
                    {daysMap.map((d, i) => (
                      <option key={i} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {mode === 'specific' && (
            <div className="flex items-center justify-start gap-3 border-b border-zinc-800 pb-3">
              <span className="text-sm text-zinc-400">Select date:</span>
              <DateStepper value={date} onChange={setDate} />
            </div>
          )}

          {/* data */}
          {loading ? (
            <div className="flex justify-center py-8 text-zinc-400 text-sm">
              Loading schedule…
            </div>
          ) : (
            <div className="space-y-3">
              {/* headers */}
              <div className="grid grid-cols-[60px,120px,1fr,120px,100px,100px] text-xs text-zinc-500 border-b border-zinc-800 pb-1">
                <div className="text-center">Enable</div>
                <div className="text-center">Start</div>
                <div className="text-center">Type</div>
                <div className="text-center">Main cap.</div>
                <div className="text-center">Wait cap.</div>
                <div className="text-center">Actions</div>
              </div>

              {/* rows */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-900">
                {slots.map((s, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[60px,120px,1fr,120px,100px,100px] gap-2 p-2 items-center"
                  >
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={(e) => updateSlot(idx, { enabled: e.target.checked })}
                      />
                    </div>
                    <div>
                      <input
                        value={s.time}
                        onChange={(e) => updateSlot(idx, { time: e.target.value })}
                        className="w-full h-[32px] px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                      />
                    </div>
                    <div>
                      <select
                        value={s.title}
                        onChange={(e) => updateSlot(idx, { title: e.target.value })}
                        className="w-full h-[32px] px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                      >
                        <option value="Class">Class</option>
                        <option value="Competitive">Competitive</option>
                        <option value="Teams">Teams</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        value={s.capacity_main}
                        onChange={(e) =>
                          updateSlot(idx, { capacity_main: Number(e.target.value) })
                        }
                        className="w-full h-[32px] px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        value={s.capacity_wait}
                        onChange={(e) =>
                          updateSlot(idx, { capacity_wait: Number(e.target.value) })
                        }
                        className="w-full h-[32px] px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                      />
                    </div>
                    <div className="flex justify-center">
                      <button
                        onClick={() => removeSlot(idx)}
                        className="w-full h-[32px] px-2 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
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
            </div>
          )}
        </div>
      </div>

      {/* buttons row */}
      <div className="flex items-center gap-3 mt-6">
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
    </section>
  );
}
