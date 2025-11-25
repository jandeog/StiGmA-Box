'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HeaderLogoMenu({ displayName }: { displayName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [badgeName, setBadgeName] = useState(displayName || '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Listen for dynamic header name update
  useEffect(() => {
    function onUpdate(e: Event) {
      const ce = e as CustomEvent;
      if (ce.detail && typeof ce.detail === 'string') {
        setBadgeName(ce.detail);
      }
    }
    window.addEventListener('header:updateName', onUpdate as EventListener);
    return () => window.removeEventListener('header:updateName', onUpdate as EventListener);
  }, []);

  // Listen for dynamic photo updates + initial load from /api/me
  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        const r = await fetch('/api/me', { cache: 'no-store' });
        const j = await r.json();
        if (!alive || !j?.me) return;

        const me = j.me;

        // If no badgeName was passed/updated yet, derive it here
        if (!badgeName) {
          const nickname = (me.nickname as string | null) || '';
          const first = (me.first_name as string | null) || '';
          const last = (me.last_name as string | null) || '';
          const initials =
            (first ? first[0] : '') + (last ? last[0] : '');
          const nameBadge = nickname || initials.toUpperCase();
          if (nameBadge) setBadgeName(nameBadge);
        }

        if (me.photo_url) {
          // cache-bust to avoid stale images on mobile
          setPhotoUrl(`${me.photo_url}?v=${Date.now()}`);
        }
      } catch (err) {
        console.error('HeaderLogoMenu: failed to load /api/me', err);
      }
    }

    loadMe();

    function onPhoto(e: Event) {
      const ce = e as CustomEvent;
      const url = ce.detail as string | null | undefined;
      setPhotoUrl(url || null);
    }

    window.addEventListener('header:updatePhoto', onPhoto as EventListener);

    return () => {
      alive = false;
      window.removeEventListener('header:updatePhoto', onPhoto as EventListener);
    };
  }, [badgeName]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // helper that closes menu before navigating
  const go = (href: string) => () => {
    setOpen(false);
    router.push(href);
  };

  async function signOut() {
    setOpen(false);
    await fetch('/api/auth/signout', { method: 'POST', cache: 'no-store' });
    if (typeof window !== 'undefined') window.location.href = '/';
    else {
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
      onClick={() => setOpen((v) => !v)}
      className="inline-flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/20"
    >
      <img
        src="/images/StiGmA_Logo.jpg"
        alt="StiGmA Box"
        width={28}
        height={28}
        className="rounded-md"
      />
      <span className="text-sm font-medium">ΣtiGmA Box</span>

      {/* Avatar: photo if present, otherwise original yellow pill */}
      {photoUrl ? (
        <span className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full overflow-hidden">
          <img
            key={photoUrl}
            src={photoUrl}
            alt={badgeName || 'Profile'}
            className="h-full w-full object-cover"
          />
        </span>
      ) : (
        badgeName && (
          <span className="ml-1 rounded-full bg-yellow-500/20 border border-yellow-400 text-yellow-300 px-2 py-0.5 text-xs">
            {badgeName}
          </span>
        )
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
          onClick={go('/schedule')}
          className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
          role="menuitem"
        >
          Book Now
        </button>
        <button
          onClick={go('/athletes/add')}
          className="block w-full px-3 py-2 text-left text-sm hover:bg-white/10"
          role="menuitem"
        >
          Settings
        </button>
        <div className="h-px bg-zinc-800" />
        <button
          onClick={signOut}
          className="block w-full px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
          role="menuitem"
        >
          Log out
        </button>
      </div>
    )}
  </div>
);

}
