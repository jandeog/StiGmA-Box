'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const supabase = getSupabaseBrowser();

export default function ScheduleGuardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data: s } = await supabase.auth.getSession();
      const uid = s.session?.user?.id;

      if (!mounted) return;

      if (!uid) {
        router.replace('/'); // όχι logged-in -> αρχική
        return;
      }

      const { data, error } = await supabase
        .from('athletes')
        .select('id')
        .eq('user_id', uid)
        .maybeSingle();

      // Δεν υπάρχει προφίλ -> πήγαινε να το φτιάξεις
      if (error?.code === 'PGRST116' || (!data && !error)) {
        router.replace('/athletes/add');
        return;
      }
      // Αν σφάλμα άλλο, άφησε τον χρήστη να μπει (και βλέπουμε logs)
      setOk(true);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (!ok) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
        Loading schedule…
      </div>
    );
  }

  return <>{children}</>;
}
