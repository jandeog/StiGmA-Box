// app/page.tsx
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page({
  searchParams,
}: {
  searchParams?: { redirect?: string };
}) {
  const target = searchParams?.redirect;
  if (target) {
    // server-side, instant redirect → καμία client εξαίρεση
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
