'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  className?: string;
  highlightedDates?: string[]; // YYYY-MM-DD dates that should be tinted
};

function DateStepperInner({
  value,
  onChange,
  className = '',
  highlightedDates = [],
}: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ---- helpers ----
  const addDays = (iso: string, delta: number) => {
    if (!iso) return iso;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
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

  // ---- calendar state synced from value ----
  const baseDate = value ? new Date(value) : new Date();
  const [month, setMonth] = useState(baseDate.getMonth());
  const [year, setYear] = useState(baseDate.getFullYear());

  useEffect(() => {
    if (!value) return;
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      setMonth(d.getMonth());
      setYear(d.getFullYear());
    }
  }, [value]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const handleSelectDate = (day: number) => {
    const yy = year;
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${yy}-${mm}-${dd}`);
    setShowPicker(false);
  };

  const today = new Date();
  const currentDate = value ? new Date(value) : today;

  const isToday = (d: number) =>
    d === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  // ---- click outside to close ----
  useEffect(() => {
    if (!showPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  return (
    <div
      ref={pickerRef}
      className={`relative flex items-center px-2.5 py-1.5 transition-colors leading-none ${className}`}
    >
      <button
        type="button"
        onClick={() => onChange(addDays(value, -1))}
        className="appearance-none min-h-0 h-auto leading-none px-3 py-2 text-[13px] hover:text-emerald-400 hover:!bg-emerald-950/40"
      >
        ←
      </button>

      <button
        type="button"
        onClick={() => setShowPicker((s) => !s)}
        className="appearance-none min-h-0 h-auto leading-none text-[13px] px-2 hover:text-emerald-400 hover:!bg-emerald-950/40"
      >
        {formatDisplay(value)}
      </button>

      <button
        type="button"
        onClick={() => onChange(addDays(value, 1))}
        className="appearance-none min-h-0 h-auto leading-none px-3 py-2 text-[13px] hover:text-emerald-400 hover:!bg-emerald-950/40"
      >
        →
      </button>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[115%] z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg p-2 w-64"
          >
            <div className="flex justify-between items-center mb-1 text-zinc-300">
              <button
                type="button"
                className="hover:text-emerald-400"
                onClick={() => {
                  if (month === 0) {
                    setMonth(11);
                    setYear((y) => y - 1);
                  } else {
                    setMonth((m) => m - 1);
                  }
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
                type="button"
                className="hover:text-emerald-400"
                onClick={() => {
                  if (month === 11) {
                    setMonth(0);
                    setYear((y) => y + 1);
                  } else {
                    setMonth((m) => m + 1);
                  }
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

                const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(
                  day,
                ).padStart(2, '0')}`;
                const hasWod = highlightedDates.includes(iso);

                const selected =
                  day === currentDate.getDate() &&
                  month === currentDate.getMonth() &&
                  year === currentDate.getFullYear();

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDate(day)}
                    className={`rounded-sm !py-[1px] !px-[2px] text-[11px] leading-none transition-colors ${
                      selected
                        ? 'bg-emerald-600 text-white'
                        : isToday(day)
                        ? 'border border-emerald-600 text-emerald-400'
                        : hasWod
                        ? 'bg-yellow-500/20 text-zinc-100 hover:bg-yellow-500/30'
                        : 'text-zinc-300 hover:bg-emerald-950/40 hover:text-emerald-400'
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

// Prevent re-renders when only the WOD form state changes
const DateStepper = React.memo(DateStepperInner);
export default DateStepper;
