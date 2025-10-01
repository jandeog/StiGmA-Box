// components/AuthActions.tsx
'use client';

import { useEffect, useState } from 'react';

function readAuth(): boolean {
  try {
    return typeof window !== 'undefined' && !!localStorage.getItem('auth:user');
  } catch {
    return false;
  }
}

export default function AuthActions() {
  // Συγχρονισμένη αρχικοποίηση (ώστε να φαίνεται άμεσα μετά από refresh)
  const [loggedIn, setLoggedIn] = useState<boolean>(() => readAuth());

  useEffect(() => {
    const update = () => setLoggedIn(readAuth());

    // 1) ενημέρωση σε αλλαγές localStorage (άλλο tab ή ίδιο)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'auth:user') update();
    };
    window.addEventListener('storage', onStorage);

    // 2) custom event από login/logout για άμεσο refresh
    window.addEventListener('auth:changed', update);

    // 3) όταν γυρνάει το tab
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) update();
    });

    // 4) αρχικό sync (σε περίπτωση SSR hydration)
    update();

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('auth:changed', update);
      // visibilitychange listener το αφήνουμε ελαφρύ — αλλιώς πρόσθεσε named fn για removeEventListener
    };
  }, []);

  const logout = () => {
    try {
      localStorage.removeItem('auth:user');
      window.dispatchEvent(new Event('auth:changed')); // ενημέρωσε όποιο component ακούει
    } finally {
      window.location.href = '/'; // πίσω στο login
    }
  };

  if (!loggedIn) return null;

  return (
    <button
      onClick={logout}
      className="px-3 py-1 rounded border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm"
      title="Sign out"
    >
      Logout
    </button>
  );
}
