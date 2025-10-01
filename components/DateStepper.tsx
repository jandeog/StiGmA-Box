// components/DateStepper.tsx
'use client';

import React from 'react';

export default function DateStepper({
  value,
  onChange,
  className = '',
}: {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  className?: string;
}) {
  const addDays = (iso: string, delta: number) => {
    if (!iso) return iso;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1); // local, avoids TZ issues
    dt.setDate(dt.getDate() + delta);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(addDays(value, -1))}
        className="px-2 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
        aria-label="Previous day"
        title="Previous day"
      >
        ←
      </button>

      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="datepicker-white-icon rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
      />

      <button
        type="button"
        onClick={() => onChange(addDays(value, 1))}
        className="px-2 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
        aria-label="Next day"
        title="Next day"
      >
        →
      </button>
    </div>
  );
}
