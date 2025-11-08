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
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    dt.setDate(dt.getDate() + delta);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const formatDisplay = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(addDays(value, -1))}
        className="px-2 py-2 rounded border border-zinc-700 hover:bg-zinc-800 text-sm"
        aria-label="Previous day"
        title="Previous day"
      >
        ←
      </button>

      <span className="min-w-[110px] text-center text-sm font-medium text-zinc-200">
        {formatDisplay(value)}
      </span>

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
