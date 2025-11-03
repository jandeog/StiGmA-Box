// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

// Accept either SUPABASE_URL (server) or NEXT_PUBLIC_SUPABASE_URL (public)
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url) throw new Error('SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL is missing');
if (!serviceRole || serviceRole.length < 20) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing/invalid');
}

export const supabaseAdmin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
