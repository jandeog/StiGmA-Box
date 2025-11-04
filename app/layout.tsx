// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import HeaderLogoMenu from '@/components/HeaderLogoMenu';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const metadata: Metadata = {
  title: 'StiGmA Box',
  description: 'Functional fitness — WOD, schedule, scoring',
};

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-200/90 hover:text-white hover:bg-zinc-800/70 transition-colors"
    >
      {label}
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read session cookie and get display name
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || '';
  let displayName: string | undefined = undefined;

  const payload = await verifySession(token);
  if (payload?.aid) {
    const { data } = await supabaseAdmin
      .from('athletes')
      .select('first_name,last_name,nickname,email')
      .eq('id', payload.aid)
      .maybeSingle();
const initials =
      ((data?.first_name?.trim()?.[0] || '') + (data?.last_name?.trim()?.[0] || '')).toUpperCase()
      || (data?.email?.split('@')[0]?.slice(0, 2)?.toUpperCase() || '');
    displayName = data?.nickname?.trim() || initials || data?.email?.split('@')[0];
  }

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-950 text-zinc-100 antialiased">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-zinc-800/70 bg-zinc-950/75 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-3 py-3">
              {/* Left: Logo + menu */}
              <HeaderLogoMenu displayName={displayName} />

              {/* Center: Tabs (desktop) */}
              <nav className="hidden md:flex items-center gap-1">
                <NavLink href="/athletes" label="Athlete" />
                <NavLink href="/schedule" label="Schedule" />
                <NavLink href="/wod" label="WOD" />
                <NavLink href="/score" label="Scores" />
              </nav>

              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href="/display"
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800/80 text-sm font-medium"
                >
                  TV Display
                </Link>
              </div>
            </div>

            {/* Secondary row for small screens: tabs full width */}
            <nav className="md:hidden grid grid-cols-2 gap-2 pb-3">
              <Link href="/athletes" className="px-3 py-2 rounded-lg text-center border border-zinc-800 bg-zinc-900/60">Athlete</Link>
              <Link href="/schedule" className="px-3 py-2 rounded-lg text-center border border-zinc-800 bg-zinc-900/60">Schedule</Link>
              <Link href="/wod" className="px-3 py-2 rounded-lg text-center border border-zinc-800 bg-zinc-900/60">WOD</Link>
              <Link href="/score" className="px-3 py-2 rounded-lg text-center border border-zinc-800 bg-zinc-900/60">Scores</Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-0 sm:px-6 lg:px-8 py-4">
          {children}
        </main>

        <footer className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 text-xs text-zinc-500">
          © {new Date().getFullYear()} StiGmA Box
        </footer>
      </body>
    </html>
  );
}
