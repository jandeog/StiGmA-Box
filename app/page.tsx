// app/page.tsx
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import HomeClient from './HomeClient';

// ✅ Η νέα σωστή υπογραφή Next.js 15+
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ redirect?: string }>;
}) {
  // ✅ Περιμένουμε το Promise αν χρειάζεται
  const params = (await searchParams) || {};
  const target = params.redirect;

  if (target) {
    redirect(`/auth/confirm?redirect=${encodeURIComponent(target)}`);
  }

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
