'use client';

import { useEffect, useState } from 'react';
import DateStepper from '@/components/DateStepper';

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
  const [mode, setMode] = useState<'template' | 'specific'>('template');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dow, setDow] = useState(1);
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [applyAllWeekdays, setApplyAllWeekdays] = useState(false);

  function getNextDateByDayOfWeek(d: number) {
    const today = new Date();
    const diff = (d + 7 - today.getDay()) % 7;
    const target = new Date(today);
    target.setDate(today.getDate() + diff);
    return target.toISOString().split('T')[0];
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg('');
      try {
        // φορτώνουμε slots μέσω του API (service key) – ποτέ direct supabase από browser
        const fetchDow = applyAllWeekdays ? 1 : dow;
        const iso = mode === 'template' ? getNextDateByDayOfWeek(fetchDow) : date;
        const res = await fetch(`/api/schedule?date=${iso}`, { credentials: 'include' });
        const { items, error } = await res.json();
        if (error) throw new Error(error);
        setSlots(items || []);
      } catch (e) {
        console.error('schedule load error', e);
        setMsg('❌ Error loading data');
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, dow, date, applyAllWeekdays]);

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
      // TODO: POST /api/schedule για αποθήκευση (template ή specific / applyAllWeekdays)
      await new Promise((r) => setTimeout(r, 400));
      setMsg('✅ Schedule saved successfully!');
    } catch {
      setMsg('❌ Error saving changes');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 2500);
    }
  }

  return (
    <section className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Change Schedule</h1>

      {/* Radios σε μία οριζόντια γραμμή, μικρό font, text δίπλα */}
      <div className="flex flex-nowrap items-center gap-6 mb-4 text-sm text-zinc-300">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            checked={mode === 'template'}
            onChange={() => setMode('template')}
          />
          <span className="whitespace-nowrap">Change Main Schedule</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            checked={mode === 'specific'}
            onChange={() => setMode('specific')}
          />
          <span className="whitespace-nowrap">Change Specific Date</span>
        </label>
      </div>

      {/* TAB / CARD — κάτω από τα radios και full width */}
<div className="rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-900 overflow-hidden">        {/* Controls row */}
        {mode === 'template' && (
          <div className="flex flex-nowrap items-center justify-between border-b border-zinc-800 pb-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyAllWeekdays}
                onChange={(e) => setApplyAllWeekdays(e.target.checked)}
              />
              <span className="text-sm whitespace-nowrap text-zinc-300">Change all week days</span>
            </label>

            {!applyAllWeekdays && (
              <div className="flex flex-nowrap items-center gap-2">
                <span className="text-sm whitespace-nowrap text-zinc-400">Day of week:</span>
                <select
                  value={dow}
                  onChange={(e) => setDow(Number(e.target.value))}
                  className="h-9 px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                >
                  {daysMap.map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {mode === 'specific' && (
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <span className="text-sm text-zinc-400">Select date:</span>
            <DateStepper value={date} onChange={setDate} />
          </div>
        )}

        {/* Data */}
        {loading ? (
          <div className="flex justify-center py-8 text-zinc-400 text-sm">
            Loading schedule…
          </div>
        ) : (
          <>
            {/* Headers – compact */}
            <div className="grid grid-cols-[64px,120px,220px,120px,110px,110px] text-xs text-zinc-500 border-b border-zinc-800 pb-1">
              <div className="text-center">Enable</div>
              <div className="text-center">Start</div>
              <div className="text-center">Type</div>
              <div className="text-center">Main cap.</div>
              <div className="text-center">Wait cap.</div>
              <div className="text-center">Actions</div>
            </div>

            {/* Rows */}
<div className="rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-900 overflow-hidden">  {slots.map((s, idx) => (
                <div
  key={idx}
  className="grid grid-cols-[64px,120px,220px,120px,110px,110px] gap-2 pl-2 pr-0 py-2 items-center"
>
                  {/* enable */}
                  <div className="flex justify-center">
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => updateSlot(idx, { enabled: e.target.checked })}
                    />
                  </div>

                  {/* time */}
                  <div>
                    <input
                      value={s.time}
                      onChange={(e) => updateSlot(idx, { time: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                    />
                  </div>

                  {/* type – αρκετό πλάτος για “Competitive” */}
                  <div>
                    <select
                      value={s.title}
                      onChange={(e) => updateSlot(idx, { title: e.target.value })}
                      className="w-full h-9 px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                    >
                      <option value="Rookie / Advanced">Rookie / Advanced</option>
                      <option value="Competitive">Competitive</option>
                      <option value="Teams">Teams</option>
                    </select>
                  </div>

                  {/* capacities */}
                  <div>
                    <input
                      type="number"
                      value={s.capacity_main}
                      onChange={(e) =>
                        updateSlot(idx, { capacity_main: Number(e.target.value) })
                      }
                      className="w-full h-9 px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={s.capacity_wait}
                      onChange={(e) =>
                        updateSlot(idx, { capacity_wait: Number(e.target.value) })
                      }
                      className="w-full h-9 px-2 rounded border border-zinc-700 bg-zinc-950 text-sm"
                    />
                  </div>

                  {/* remove – ίδιο ύψος με όλα τα inputs */}
                  <div className="-mr-2"> {/* ακυρώνει το μικρό δεξί περιθώριο */}
  <button
    onClick={() => removeSlot(idx)}
    className="w-full h-9 px-2 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
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

            {/* Actions – ΜΕΣΑ στο tab */}
            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                onClick={handleApply}
                disabled={saving}
                className="px-3 h-9 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm flex items-center gap-2"
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
                onClick={() => history.back()}
                className="px-3 h-9 rounded border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm"
              >
                Cancel
              </button>
              {msg && <div className="text-sm text-zinc-400">{msg}</div>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
