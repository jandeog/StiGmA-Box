// lib/supabase/server.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const supabaseServer = async () => {
  const cookieStore = await cookies(); // <-- await εδώ

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Τα methods μπορούν να είναι async – το @supabase/ssr το υποστηρίζει
        get: async (name: string) => cookieStore.get(name)?.value,
        set: async (name: string, value: string, options?: any) => {
          (await cookies()).set({ name, value, ...(options ?? {}) });
        },
        remove: async (name: string, options?: any) => {
          (await cookies()).set({ name, value: '', ...(options ?? {}), maxAge: 0 });
        },
      },
    }
  );
};
