'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function creditColor(n: number) {
  if (n < 3) return 'border-red-600 text-red-300';
  if (n < 5) return 'border-orange-600 text-orange-300';
  return 'border-emerald-700 text-emerald-300';
}

type Props = {
  initialCredits: number;
  initialIsCoach: boolean;
  signedIn: boolean;
};

type CreditsWarning = {
  days_left: number;
  will_reset_at?: string;
} | null;

export default function HeaderCredits({ initialCredits, initialIsCoach, signedIn }: Props) {
  const [credits, setCredits] = useState<number>(initialCredits);
  const [isCoach, setIsCoach] = useState<boolean>(initialIsCoach);
  const [warning, setWarning] = useState<CreditsWarning>(null);

  async function refresh() {
    try {
      const r = await fetch('/api/me', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (j?.me) {
        setCredits(Number(j.me.credits ?? credits));
        setIsCoach(!!j.me.is_coach);
        setWarning(j.me.credits_warning ?? null);
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!signedIn) return;

    const onFocus = () => refresh();
    const onRefresh = () => refresh();

    window.addEventListener('focus', onFocus);
    window.addEventListener('credits:refresh', onRefresh as EventListener);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('credits:refresh', onRefresh as EventListener);
    };
  }, [signedIn]);

  if (!signedIn) {
    return (
      <Link
        href="/display"
        className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/80 text-sm font-medium"
      >
        TV Display
      </Link>
    );
  }

  const pillClasses = `px-3 py-2 rounded-lg border bg-zinc-900/60 hover:bg-zinc-800/80 text-sm font-medium ${creditColor(
    credits,
  )}`;

  // Coaches still see credits, but warning text only matters for athletes.
  const warningText =
    warning && warning.days_left > 0
      ? `Credits reset in ${warning.days_left} day${warning.days_left === 1 ? '' : 's'}`
      : warning && warning.days_left === 0
      ? 'Credits have been reset'
      : null;

  if (isCoach) {
    return (
      <Link href="/display" className={pillClasses}>
        Credits: {credits}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={`px-2.5 py-1.5 rounded-full border text-sm font-medium ${creditColor(credits)}`}>
        Credits: {credits}
      </span>
      {warningText && (
        <span className="text-[11px] text-orange-300">
          {warningText}
        </span>
      )}
    </div>
  );
}
