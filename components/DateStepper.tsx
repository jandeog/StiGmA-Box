'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DateStepper({
  value,
  onChange,
  className = '',
}: {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  className?: string;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    if (showPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

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

  const currentDate = new Date(value);
  const [month, setMonth] = useState(currentDate.getMonth());
  const [year, setYear] = useState(currentDate.getFullYear());

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handleSelectDate = (day: number) => {
    const yy = year;
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const newIso = `${yy}-${mm}-${dd}`;
    onChange(newIso);
    setShowPicker(false);
  };

  const today = new Date();
  const isToday = (d: number) =>
    d === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  return (
    <div
      ref={pickerRef}
      className={`relative inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:border-green-500 transition-colors ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange(addDays(value, -1))}
        className="px-2 py-1 rounded-md hover:bg-zinc-800 text-sm"
        aria-label="Previous day"
      >
        ←
      </button>

      <button
        type="button"
        onClick={() => setShowPicker(!showPicker)}
        className="min-w-[110px] text-center text-sm font-medium text-zinc-200 hover:text-green-400"
      >
        {formatDisplay(value)}
      </button>

      <button
        type="button"
        onClick={() => onChange(addDays(value, 1))}
        className="px-2 py-1 rounded-md hover:bg-zinc-800 text-sm"
        aria-label="Next day"
      >
        →
      </button>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-[110%] z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-3 w-64"
          >
            <div className="flex justify-between items-center mb-2 text-zinc-300">
              <button
                className="hover:text-green-400"
                onClick={() => {
                  if (month === 0) {
                    setMonth(11);
                    setYear(year - 1);
                  } else setMonth(month - 1);
                }}
              >
                ←
              </button>
              <div className="text-sm font-medium">
                {new Date(year, month).toLocaleString('default', {
                  month: 'long',
                })}{' '}
                {year}
              </div>
              <button
                className="hover:text-green-400"
                onClick={() => {
                  if (month === 11) {
                    setMonth(0);
                    setYear(year + 1);
                  } else setMonth(month + 1);
                }}
              >
                →
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-zinc-400 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const selected =
                  day === currentDate.getDate() &&
                  month === currentDate.getMonth() &&
                  year === currentDate.getFullYear();
                return (
                  <button
                    key={day}
                    onClick={() => handleSelectDate(day)}
                    className={`rounded-md py-1 text-sm transition-colors ${
                      selected
                        ? 'bg-green-600 text-white'
                        : isToday(day)
                        ? 'border border-green-600 text-green-400'
                        : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}