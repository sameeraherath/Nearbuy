'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { bool, errorText, str, type ActionState } from '@/lib/actions';

export async function setBlocked(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const blocked = bool(form, 'blocked');
  const { error } = await supabase.rpc('admin_set_customer_blocked', {
    p_phone: str(form, 'phone'),
    p_blocked: blocked,
  });
  if (error) return { error: errorText(error) };
  revalidatePath('/customers');
  return { ok: blocked ? 'Blocked' : 'Unblocked' };
}
