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

const GRID_MD = 'grid grid-cols-[64px,120px,260px,140px,120px,1fr]';
const CTRL =
  'h-10 box-border px-3 rounded-md border border-zinc-700 bg-zinc-950 text-sm leading-none w-full';
const BTN =
  'inline-flex items-center justify-center h-10 box-border px-3 rounded-md text-sm leading-none';

// Days map
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

  // Load data via API (server-side service key)
  useEffect(() => {
    (async () => {
      setLoading(true);
      setMsg('');
      try {
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
      // TODO: POST /api/schedule (template/specific/applyAllWeekdays)
      await new Promise((r) => setTimeout(r, 350));
      setMsg('✅ Schedule saved successfully!');
    } catch {
      setMsg('❌ Error saving changes');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 2200);
    }
  }

  return (
    <section className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-semibold mb-4">Change Schedule</h1>

      {/* Radios row */}
      <div className="flex flex-wrap items-center gap-6 mb-4 text-sm text-zinc-300">
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

      {/* Card / Tab */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 shadow-inner space-y-4">
        {/* Controls */}
        {mode === 'template' ? (
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-zinc-800 pb-3">
    <label className="inline-flex items-center gap-2 flex-row-reverse md:flex-row self-start">
              <input
                type="checkbox"
                checked={applyAllWeekdays}
                onChange={(e) => setApplyAllWeekdays(e.target.checked)}
                        className="h-5 w-5"

              />
      <span className="text-sm text-zinc-300">Change all week days</span>
            </label>

            {!applyAllWeekdays && (
      <div className="flex items-center gap-2 w-full md:w-auto">
        <span className="text-sm text-zinc-400 whitespace-nowrap">Day of week:</span>
        <select
          value={dow}
          onChange={(e) => setDow(Number(e.target.value))}
          className="h-10 px-2 rounded-md border border-zinc-700 bg-zinc-950 text-sm w-full md:w-[220px]"
        >
          {daysMap.map((d, i) => (
            <option key={i} value={i}>{d}</option>
          ))}
        </select>
      </div>

            )}
          </div>
        ) : (
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
            {/* Desktop header */}
            <div className={`${GRID_MD} gap-2 pl-2 pr-2 pb-1 text-xs text-zinc-500 border-b border-zinc-800 hidden md:grid`}>
              <div className="text-center">Enable</div>
              <div className="text-center">Start</div>
              <div className="text-center">Type</div>
              <div className="text-center">Main cap.</div>
              <div className="text-center">Wait cap.</div>
              <div className="text-center">Actions</div>
            </div>

            {/* Rows */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 divide-y divide-zinc-900 overflow-hidden">
              {slots.map((s, idx) => (
                <div
                  key={idx}
                  className={`${GRID_MD} gap-2 pl-2 pr-2 py-2 items-stretch
                              md:grid
                              hidden`}
                >
                  {/* Desktop row */}
                  <div className="flex items-center justify-center">
                    <input
                      aria-label={`Enable slot ${idx + 1}`}
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => updateSlot(idx, { enabled: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </div>

                  <div className="flex"><input value={s.time} onChange={(e) => updateSlot(idx, { time: e.target.value })} className={`${CTRL} h-full`} /></div>
                  <div className="flex">
                    <select
                      value={s.title}
                      onChange={(e) => updateSlot(idx, { title: e.target.value })}
                      className={`${CTRL} h-full`}
                    >
                      <option value="Class">Class</option>
                      <option value="Competitive">Competitive</option>
                      <option value="Teams">Teams</option>
                    </select>
                  </div>
                  <div className="flex"><input type="number" value={s.capacity_main} onChange={(e) => updateSlot(idx, { capacity_main: Number(e.target.value) })} className={`${CTRL} h-full`} /></div>
                  <div className="flex"><input type="number" value={s.capacity_wait} onChange={(e) => updateSlot(idx, { capacity_wait: Number(e.target.value) })} className={`${CTRL} h-full`} /></div>

                  <div className="flex -mr-2">
                    <button
                      onClick={() => removeSlot(idx)}
                      className={`${BTN} w-full border border-red-800 text-red-300 hover:bg-red-900/20`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-zinc-900">
                {slots.map((s, idx) => (
                  <div key={`m-${idx}`} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={s.enabled}
                          onChange={(e) => updateSlot(idx, { enabled: e.target.checked })}
                        />
                        <span>Enable</span>
                      </label>
                      <button
                        onClick={() => removeSlot(idx)}
                        className="border border-red-800 text-red-300 px-3 py-1.5 rounded-md text-xs"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Start</div>
                        <input
                          value={s.time}
                          onChange={(e) => updateSlot(idx, { time: e.target.value })}
                          className={CTRL}
                        />
                      </div>

                      <div>
                        <div className="text-xs text-zinc-500 mb-1">Type</div>
                        <select
                          value={s.title}
                          onChange={(e) => updateSlot(idx, { title: e.target.value })}
                          className={CTRL}
                        >
                          <option value="Class">Class</option>
                          <option value="Competitive">Competitive</option>
                          <option value="Teams">Teams</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Main cap.</div>
                          <input
                            type="number"
                            value={s.capacity_main}
                            onChange={(e) => updateSlot(idx, { capacity_main: Number(e.target.value) })}
                            className={CTRL}
                          />
                        </div>
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Wait cap.</div>
                          <input
                            type="number"
                            value={s.capacity_wait}
                            onChange={(e) => updateSlot(idx, { capacity_wait: Number(e.target.value) })}
                            className={CTRL}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="p-3">
                  <button
                    onClick={addSlot}
                    className="px-3 py-2 rounded-md border border-zinc-700 hover:bg-zinc-800 text-sm w-full"
                  >
                    + Add slot
                  </button>
                </div>
              </div>
            </div>

            {/* Actions inside the card */}
            <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
              <button
                onClick={handleApply}
                disabled={saving}
                className={`${BTN} px-4 border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20`}
              >
                {saving ? 'Saving…' : 'Apply'}
              </button>
              <button
                onClick={() => history.back()}
                className={`${BTN} px-4 border border-zinc-700 text-zinc-300 hover:bg-zinc-800`}
              >
                Cancel
              </button>
              {msg && <div className="text-sm text-zinc-400 self-center sm:self-end">{msg}</div>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
