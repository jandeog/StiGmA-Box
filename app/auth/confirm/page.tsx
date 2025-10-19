'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase =
  typeof window !== 'undefined'
    ? createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    : (null as any);

export default function AuthCallback() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    let mounted = true;
    (async () => {
      // περιμένουμε να ολοκληρωθεί το session μετά το click στο email
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!mounted) return;

      if (!hasSession) {
        // αν για κάποιο λόγο δεν υπάρχει session, στείλε στην αρχική
        router.replace('/');
        return;
      }

      // new=1 => νέος χρήστης -> συμπλήρωση προφίλ
      if (sp.get('new') === '1') {
        router.replace('/athletes/add');
        return;
      }

      // αλλιώς κανονικά στο schedule
      router.replace('/schedule');
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
