'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LegacyLoginShim() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/'); // Όλη η είσοδος γίνεται πια από την αρχική
  }, [router]);
  return null;
}
