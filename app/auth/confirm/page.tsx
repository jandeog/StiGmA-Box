// app/auth/confirm/page.tsx (Server Component wrapper)
import { Suspense } from 'react';
import ConfirmClient from './ConfirmClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
      Completing sign-in…
    </div>}>
      <ConfirmClient />
    </Suspense>
  );
}
