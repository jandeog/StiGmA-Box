// components/RoleBadge.tsx
'use client';

import { useEffect, useState } from 'react';

type Session = { role: 'coach' | 'athlete' };

function readRole(): 'coach' | 'athlete' | null {
  try {
    const raw = localStorage.getItem('auth:user');
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.role ?? null;
  } catch {
    return null;
  }
}

export default function RoleBadge() {
  const [role, setRole] = useState<'coach' | 'athlete' | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const update = () => setRole(readRole());
    update();
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth:user') update();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('auth:changed', update);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth:changed', update);
    };
  }, []);

  if (!mounted || role !== 'coach') return null;

  return (
    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-emerald-700 text-emerald-300">
      coach
    </span>
  );
}
