'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

const supabase = getSupabaseBrowser();

type TemplateSlot = {
  id?: string;
  day_of_week: number;
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
  const [slots, setSlots] = useState<TemplateSlot[]>([]);
  const [dow, setDow] = useState<number>(1);
  const [msg, setMsg] = useState('');

  // Load template from Supabase
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('schedule_template')
        .select('*')
        .eq('day_of_week', dow)
        .order('time', { ascending: true });
      if (error) console.error(error);
      setSlots(data || []);
    })();
  }, [dow]);

  async function saveTemplate() {
    // replace old rows with updated ones
    const { error: delErr } = await supabase
      .from('schedule_template')
      .delete()
      .eq('day_of_week', dow);
    if (delErr) {
      console.error(delErr);
      setMsg('❌ Error saving');
      return;
    }

    const rows = slots.map(s => ({
      day_of_week: dow,
      time: s.time,
      title: s.title,
      capacity_main: s.capacity_main,
      capacity_wait: s.capacity_wait,
      enabled: s.enabled,
    }));

    const { error } = await supabase.from('schedule_template').insert(rows);
    if (error) {
      console.error(error);
      setMsg('❌ Error saving');
    } else {
      setMsg('✅ Template saved');
      setTimeout(() => setMsg(''), 1500);
    }
  }

  function updateSlot(index: number, patch: Partial<TemplateSlot>) {
    setSlots(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSlot() {
    setSlots(prev => [
      ...prev,
      {
        day_of_week: dow,
        time: '07:00',
        title: dow === 6 ? 'Teams' : 'Class',
        capacity_main: dow === 6 ? 18 : 14,
        capacity_wait: 2,
        enabled: true,
      },
    ]);
  }

  function removeSlot(index: number) {
    setSlots(prev => prev.filter((_, i) => i !== index));
  }

  // Apply template to schedule_slots table for given date range
  async function applyToSchedule(daysAhead = 30) {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + daysAhead);

    const allDates: string[] = [];
    const cur = new Date(today);
    while (cur <= end) {
      allDates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    const allSlots: any[] = [];
    for (const date of allDates) {
      const d = new Date(date);
      const dow = d.getDay();
      const { data } = await supabase
        .from('schedule_template')
        .select('*')
        .eq('day_of_week', dow)
        .eq('enabled', true);
      for (const s of data || []) {
        allSlots.push({
          date,
          time: s.time,
          title: s.title,
          capacity_main: s.capacity_main,
          capacity_wait: s.capacity_wait,
        });
      }
    }

    if (allSlots.length > 0) {
      const { error } = await supabase.from('schedule_slots').insert(allSlots);
      if (error) {
        console.error(error);
        setMsg('❌ Apply failed');
      } else {
        setMsg(`✅ ${allSlots.length} slots added`);
        setTimeout(() => setMsg(''), 1500);
      }
    }
  }

  return (
    <section className="max-w-4xl mx-auto p-4">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Change Schedule</h1>
        <Link href="/schedule" className="text-sm underline text-zinc-300">
          Back
        </Link>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <label className="text-sm text-zinc-400">Day of week:</label>
        <select
          value={dow}
          onChange={(e) => setDow(Number(e.target.value))}
          className="px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
        >
          {daysMap.map((d, i) => (
            <option key={i} value={i}>{d}</option>
          ))}
        </select>
        <button
          onClick={saveTemplate}
          className="ml-auto px-3 py-1.5 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
        >
          Save template
        </button>
      </div>

      {/* Editable slots */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950">
        {slots.map((s, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 p-2 border-b border-zinc-900 items-center">
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
            <div className="col-span-2">
              <input
                type="number"
                value={s.capacity_wait}
                onChange={(e) => updateSlot(idx, { capacity_wait: Number(e.target.value) })}
                className="w-full px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm"
              />
              <button
                onClick={() => removeSlot(idx)}
                className="ml-2 px-2 py-1 rounded border border-red-800 text-red-300 hover:bg-red-900/20 text-xs"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <div className="p-2">
          <button onClick={addSlot} className="px-3 py-1.5 rounded border border-zinc-700 hover:bg-zinc-800 text-sm">
            + Add slot
          </button>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => applyToSchedule(30)}
          className="px-3 py-2 rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900/20 text-sm"
        >
          Apply next 30 days
        </button>
        {msg && <div className="text-sm text-zinc-300">{msg}</div>}
      </div>
    </section>
  );
}
