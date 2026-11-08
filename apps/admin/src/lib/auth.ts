import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Verifies the session and that the user is an unblocked admin. Returns a server client. */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role, is_blocked')
    .eq('id', uid)
    .maybeSingle();
  if (!profile || profile.role !== 'admin' || profile.is_blocked) redirect('/login?error=not_admin');

  return { supabase, profile };
}
