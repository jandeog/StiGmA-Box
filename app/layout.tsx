import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import { cookies } from 'next/headers';
import HeaderLogoMenu from '@/components/HeaderLogoMenu';
import HeaderCredits from '@/components/HeaderCredits';
import { verifySession, SESSION_COOKIE } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import HeaderNavIcons from '@/components/HeaderNavIcons';
import PendingScoreReminder from '@/components/PendingScoreReminder';

export const metadata: Metadata = {
  title: 'StiGmA Box',
  description: 'Functional fitness — WOD, schedule, scoring',
};

const ICON_ITEMS = [
  {
    href: '/athletes',
    label: 'Athletes',
    staticSrc: '/icons/Athletes_static.png',
    hoverSrc: '/icons/Athletes_hover.png',
  },
  {
    href: '/schedule',
    label: 'Schedule',
    staticSrc: '/icons/Schedule_static.png',
    hoverSrc: '/icons/Schedule_hover.png',
  },
  {
    href: '/score',
    label: 'Score',
    staticSrc: '/icons/Score_static.png',
    hoverSrc: '/icons/Score_hover.png',
  },
  {
    href: '/wod',
    label: 'WOD',
    staticSrc: '/icons/WOD_static.png',
    hoverSrc: '/icons/WOD_hover.png',
  },
];

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value || '';

  const payload = await verifySession(token);
  let displayName: string | undefined;
  let isCoach = false;
  let credits = 0;
  let signedIn = false;

  if (payload?.aid) {
    signedIn = true;

    const { data } = await supabaseAdmin
      .from('athletes')
      .select('first_name,last_name,nickname,email,credits,is_coach')
      .eq('id', payload.aid)
      .maybeSingle();

    const initials =
      ((data?.first_name?.trim()?.[0] || '') +
        (data?.last_name?.trim()?.[0] || '')).toUpperCase() ||
      (data?.email?.split('@')[0]?.slice(0, 2)?.toUpperCase() || '');

    displayName =
      data?.nickname?.trim() || initials || data?.email?.split('@')[0];

    isCoach = !!data?.is_coach;
    credits = data?.credits ?? 0;
  }

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-950 text-zinc-100 antialiased">
        {signedIn && (
          <header className="sticky top-0 z-50 w-full border-b border-zinc-800/70 bg-zinc-950/75 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-3 py-3">
                {/* Left: Logo + user menu */}
                <HeaderLogoMenu displayName={displayName} />

                {/* Center: desktop icons */}
                <HeaderNavIcons items={ICON_ITEMS} variant="desktop" />

                {/* Right: credits */}
                <HeaderCredits
                  initialCredits={credits}
                  initialIsCoach={isCoach}
                  signedIn={signedIn}
                />
              </div>

              {/* Mobile icons */}
              <HeaderNavIcons items={ICON_ITEMS} variant="mobile" />
            </div>
          </header>
        )}

        <main className="mx-auto max-w-6xl px-0 sm:px-6 lg:px-8 py-4">
          {children}
        </main>

        <footer className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 text-xs text-zinc-500">
          © {new Date().getFullYear()} StiGmA Box
        </footer>
        {signedIn && <PendingScoreReminder />}
        {/* Global reminder for pending scores */}
        <PendingScoreReminder />
      </body>
    </html>
  );
}
