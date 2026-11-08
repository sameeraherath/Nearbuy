import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@nearbuy/shared';

/** Service-role client. Bypasses RLS: only use after requireAdmin(). */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
