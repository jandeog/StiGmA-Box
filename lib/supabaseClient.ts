// lib/supabaseClient.ts
import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseBrowser() {
  // Automatically reads and persists user session (cookies/localStorage)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
