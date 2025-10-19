'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase =
  typeof window !== 'undefined'
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : (null as any);

// (προαιρετικό, αλλά καλό για ασφάλεια απέναντι σε SSG)
export const dynamic = 'force-dynamic';

export default function AuthConfirmPage() {
  return (
    <Suspense fallback={<div className="min-h-[70vh] grid place-items-center text-sm text-zinc-400">Loading…</div>}>
      <AuthConfirmInner />
    </Suspense>
  );
}

function AuthConfirmInner() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!mounted) return;

      if (!hasSession) {
        // Αν για κάποιο λόγο δεν ολοκληρώθηκε το session από το email link
        router.replace('/');
        return;
      }

      if (sp.get('new') === '1') {
        router.replace('/athletes/add');
      } else {
        router.replace('/schedule');
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router, sp]);

  return (
    <div className="min-h-[70vh] grid place-items-center text-sm text-zinc-400">
      Completing sign-in…
    </div>
  );
}
