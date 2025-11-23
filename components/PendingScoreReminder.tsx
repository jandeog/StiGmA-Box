'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type PendingItem = {
  participantId: string;
  slotId: string;
  date: string | null; // 'YYYY-MM-DD' or null
  time: string | null; // 'HH:MM' or null
  hasScore: boolean;
};

type ApiResponse = {
  items: PendingItem[];
};

function formatClassTimeLabel(raw?: string | null): string {
  if (!raw) return '';
  const [hStr = '0', mStr = '0'] = raw.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return raw;

  const suffix = h < 12 ? 'AM' : 'PM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  const minutePart = m === 0 ? '' : `.${m.toString().padStart(2, '0')}`;
  return `${hour12}${minutePart} ${suffix}`;
}

export default function PendingScoreReminder() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingItem[] | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(
    new Set<string>(),
  );

  // Load dismiss state from localStorage (so we don't nag every refresh)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('pendingScoreDismissed');
      if (!raw) return;
      const arr: string[] = JSON.parse(raw);
      setDismissedKeys(new Set(arr));
    } catch {
      /* ignore */
    }
  }, []);

  // Fetch pending items once on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/scores/pending', {
          cache: 'no-store',
        });

        if (!res.ok) {
          // silently ignore errors
          return;
        }

        const text = await res.text();
        let data: ApiResponse | null = null;

        try {
          data = JSON.parse(text) as ApiResponse;
        } catch (e) {
          console.error('pending scores: response is not JSON', text);
          return;
        }

        if (cancelled || !data) return;

        setPending(data.items || []);
      } catch (err) {
        console.error('pending scores fetch failed', err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pending || pending.length === 0) return null;

  const item = pending[0];

  const key = `${item.slotId}`; // no date yet, key by slot
  if (dismissedKeys.has(key)) return null;

  const prettyTime = formatClassTimeLabel(item.time ?? undefined);
  let prettyDate: string | null = null;

  if (item.date) {
    const parts = item.date.split('-'); // YYYY-MM-DD
    if (parts.length === 3) {
      const [y, m, d] = parts;
      prettyDate = `${d}-${m}-${y}`;
    } else {
      prettyDate = item.date;
    }
  }

  const onDismiss = () => {
    const next = new Set(dismissedKeys);
    next.add(key);
    setDismissedKeys(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'pendingScoreDismissed',
        JSON.stringify(Array.from(next)),
      );
    }
  };

const onGoToScores = () => {
  if (item.date) {
    const params = new URLSearchParams({ date: item.date });
    router.push(`/score?${params.toString()}`);
  } else {
    router.push('/score');
  }
};


  const hasNiceInfo = !!prettyTime || !!prettyDate;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-[90%]">
      <div className="border border-emerald-700 bg-zinc-900/95 rounded-lg px-3 py-3 shadow-lg flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 text-sm text-zinc-100">
          <div className="font-semibold text-emerald-300 mb-0.5">
            Missing score for a booked class
          </div>
          <div className="text-xs text-zinc-300">
            {hasNiceInfo ? (
              <>
                You were booked in{' '}
                <span className="font-medium">
                  {prettyTime ? `${prettyTime}` : ''}
                  {prettyTime && prettyDate ? ' • ' : ''}
                  {prettyDate ?? ''}
                </span>{' '}
                but haven&apos;t added your score yet. Add it now to confirm
                your attendance.
              </>
            ) : (
              <>
                You have a booked class without a recorded score. Add your score
                now to confirm your attendance.
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onDismiss}
            className="px-2.5 py-1.5 text-[11px] rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onGoToScores}
            className="px-3 py-1.5 text-[11px] rounded-md border border-emerald-600 bg-emerald-700/20 text-emerald-200 hover:bg-emerald-700/40"
          >
            Add score
          </button>
        </div>
      </div>
    </div>
  );
}
