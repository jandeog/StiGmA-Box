'use client';
import { useRouter } from 'next/navigation';
export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth/signout', { method: 'POST' });
        router.replace('/');
      }}
      className="rounded-md border border-zinc-700 px-2 py-1 text-xs"
    >
      Sign out
    </button>
  );
}
