import { supabaseServer } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function MePage() {
  const supa = await supabaseServer();
  const { data: { user } } = await supa.auth.getUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="mb-4">Not logged in.</p>
        <Link href="/auth/login" className="underline">Go to login</Link>
      </div>
    );
  }

  const role = (user.app_metadata as any)?.role ?? 'athlete (default)';
  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">You are logged in</h1>
      <div className="rounded-xl border border-zinc-800 p-4 bg-zinc-900">
        <div><b>Email:</b> {user.email}</div>
        <div><b>User ID:</b> {user.id}</div>
        <div><b>Role:</b> {String(role)}</div>
      </div>

      <div className="space-x-3">
        <a href="/api/athletes" className="underline">Open /api/athletes</a>
        <a href="/api/scores" className="underline">Open /api/scores</a>
      </div>

      <p className="text-sm text-zinc-400">
        RLS: coach/admin βλέπουν όλα. athlete βλέπει μόνο τα δικά του (αν ο δικός του athlete row έχει το user_id του).
      </p>
    </div>
  );
}
