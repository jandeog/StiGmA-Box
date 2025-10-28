// app/page.tsx
import { Suspense } from 'react';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] grid place-items-center text-sm text-zinc-400">
          Loading…
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
