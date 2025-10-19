'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase =
  typeof window !== 'undefined'
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : (null as any);

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;

      if (!mounted) return;

      if (!uid) {
        router.replace('/');
        return;
      }

      // Έλεγχος ύπαρξης athlete
      const { data, error } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();

      if (error?.code === 'PGRST116' || (!data && !error)) {
        router.replace('/athletes/add');
        return;
      }
      if (!data && error) {
        console.warn('athletes lookup error', error);
        router.replace('/schedule');
        return;
      }
      router.replace('/schedule');
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="min-h-[70vh] grid place-items-center text-sm text-zinc-400">
      Completing sign-in…
    </div>
  );
}
