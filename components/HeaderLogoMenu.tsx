'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HeaderLogoMenu({ displayName }: { displayName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

async function signOut() {
  setOpen(false); // close dropdown immediately
  await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' });

  // Force a fresh render so the server layout re-reads cookies
  if (typeof window !== 'undefined') {
    window.location.href = '/';       // hard reload guarantees badge disappears
  } else {
    router.replace('/');
    router.refresh();
  }
}


  return (
    <div className="relative">
      <button
        ref={btnRef}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
      >
        <img
          src="/images/StiGmA_Logo.jpg"
          alt="StiGmA Box"
          width={28}
          height={28}
          className="rounded-md"
          onError={(e) => {
            // graceful fallback if the image is missing/corrupted
            const img = e.currentTarget;
            img.src = '/favicon.ico';
            img.width = 20;
            img.height = 20;
            img.classList.add('rounded');
          }}
        />
        <span className="text-sm font-medium">StiGmA Box</span>
        {displayName && (
          <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-zinc-200 border border-zinc-700">
            {displayName}
          </span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-70">
          <path d="M7 10l5 5 5-5H7z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute z-50 mt-2 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/95 shadow-lg backdrop-blur"
        >
          <button
            role="menuitem"
            onClick={() => { setOpen(false); router.push('/schedule'); }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
          >
            Book Now
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); router.push('/athletes/add'); }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
          >
            Settings
          </button>
          <div className="h-px bg-zinc-800" />
          <button
            role="menuitem"
            onClick={signOut}
            className="block w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
