import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

// Διαδρομές που δεν απαιτούν auth
const PUBLIC_PATHS = new Set<string>([
  '/',                // η αρχική (το πραγματικό login UI)
  '/auth/confirm',    // επιστροφή από OTP / magic link
  '/auth/reset',      // φόρμα reset password
  '/favicon.ico',
])

// Διαδρομές που απαιτούν auth (πρόσθεσε/βγάλε ανάλογα)
const PROTECTED_PREFIXES = [
  '/schedule',        // αν θες να προστατεύεται όλο το schedule
  '/score',
  '/athletes/add',
  '/auth/me',         // μόνο για logged-in
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Αν είναι public route, μη κάνεις τίποτα
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next()
  }

  // Αν ΔΕΝ είναι protected route, συνέχισε κανονικά
  const needsAuth = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))
  if (!needsAuth) {
    return NextResponse.next()
  }

  // Protected route → έλεγχος χρήστη
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // Στείλε κατευθείαν στην αρχική (/), ΟΧΙ στο /auth/login
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return res
}

// Εξαιρέσεις για assets + API
export const config = {
  matcher: [
    // όλα εκτός από _next, static assets, images, api
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
