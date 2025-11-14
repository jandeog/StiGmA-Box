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

export default function HeaderCredits({ initialCredits, initialIsCoach, signedIn }: Props) {
  const [credits, setCredits] = useState<number>(initialCredits);
  const [isCoach, setIsCoach] = useState<boolean>(initialIsCoach);

  async function refresh() {
    try {
      const r = await fetch('/api/me', { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (j?.me) {
        setCredits(Number(j.me.credits ?? credits));
        setIsCoach(!!j.me.is_coach);
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    if (!signedIn) return;

    // First paint: keep SSR value; we’ll refresh on first event or focus
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

  const classes = `px-3 py-2 rounded-lg border bg-zinc-900/60 hover:bg-zinc-800/80 text-sm font-medium ${creditColor(credits)}`;
  return isCoach ? (
    <Link href="/display" className={classes}>
      Credits: {credits}
    </Link>
  ) : (
    <span className={`px-2.5 py-1.5 rounded-full border text-sm font-medium ${creditColor(credits)}`}>
      Credits: {credits}
    </span>
  );
}
