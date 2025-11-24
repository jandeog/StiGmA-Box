'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type PendingItem = {
  participantId: string;
  slotId: string;
  date: string | null; // 'YYYY-MM-DD'
  time: string | null; // 'HH:MM'
  hasScore: boolean;
  attended?: boolean;
};

type ApiResponse = {
  items: PendingItem[];
};

type PendingScoreReminderProps = {
  isCoach?: boolean;
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

export default function PendingScoreReminder({ isCoach }: PendingScoreReminderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // 1) Never show for coaches
  if (isCoach) return null;

  const [pending, setPending] = useState<PendingItem[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Helper to load pending items
  const fetchPending = async () => {
    try {
      const res = await fetch('/api/scores/pending', { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      let data: ApiResponse;
      try {
        data = JSON.parse(text) as ApiResponse;
      } catch {
        console.error('pending scores: response is not JSON', text);
        return;
      }
      setPending(data.items || []);
    } catch (err) {
      console.error('pending scores fetch failed', err);
    }
  };

  // Initial load + refresh when path changes
  useEffect(() => {
    fetchPending();
  }, [pathname]);

  // Auto-refresh when score is submitted (from Score page)
  useEffect(() => {
    const handler = () => {
      setDismissed(false); // in case we hid it this session
      fetchPending();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('score-submitted', handler);
      return () => window.removeEventListener('score-submitted', handler);
    }
  }, []);

  if (dismissed) return null;
  if (!pending || pending.length === 0) return null;

  // Sort by date (oldest first) so we handle multiple dates one-by-one
  const sorted = [...pending].sort((a, b) => {
    const ad = a.date || '';
    const bd = b.date || '';
    if (ad === bd) return (a.time || '').localeCompare(b.time || '');
    return ad.localeCompare(bd);
  });

  const item = sorted[0];
  if (!item.date) return null;

  const prettyTime = formatClassTimeLabel(item.time ?? undefined);
  const [y, m, d] = item.date.split('-');
  const prettyDate = d && m && y ? `${d}-${m}-${y}` : item.date;

  const onDismiss = () => {
    // 4) "Later" = hide for *this session only*.
    // Next login / full reload will show it again if still pending.
    setDismissed(true);
  };

  const onGoToScores = () => {
    // 2 & 3) Go to score page for that specific date
    const params = new URLSearchParams({ date: item.date! });
    router.push(`/score?${params.toString()}`);
  };

  const total = pending.length;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-[90%]">
      <div className="border border-emerald-700 bg-zinc-900/95 rounded-lg px-3 py-3 shadow-lg flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 text-sm text-zinc-100">
          <div className="font-semibold text-emerald-300 mb-0.5">
            Missing score for a booked class
          </div>
          <div className="text-xs text-zinc-300">
            {total > 1 && (
              <div className="mb-0.5 text-[11px] text-emerald-300/80">
                You have scores missing for {total} classes. First one:
              </div>
            )}
            You were booked in{' '}
            <span className="font-medium">
              {prettyTime ? `${prettyTime} • ` : ''}
              {prettyDate}
            </span>{' '}
            but haven&apos;t added your score yet. Add it now to confirm your
            attendance.
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
