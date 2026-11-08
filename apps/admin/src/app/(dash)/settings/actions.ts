'use server';

import { revalidatePath } from 'next/cache';
import { settingsSchema } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { bool, errorText, int, str, type ActionState } from '@/lib/actions';

export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = settingsSchema.safeParse({
    cutoff_time: str(form, 'cutoff_time'),
    delivery_window_text: str(form, 'delivery_window_text'),
    ordering_enabled: bool(form, 'ordering_enabled'),
    delivery_fee: int(form, 'delivery_fee') ?? -1,
    free_delivery_over: int(form, 'free_delivery_over'),
    free_delivery_until: str(form, 'free_delivery_until') || null,
    min_order_amount: int(form, 'min_order_amount') ?? -1,
    rider_pay_per_delivery: int(form, 'rider_pay_per_delivery') ?? -1,
    help_phone: str(form, 'help_phone'),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `${issue.path.join('.')}: ${issue.message}` : 'Invalid settings' };
  }
  const { error } = await supabase.from('settings').update(parsed.data).eq('id', true);
  if (error) return { error: errorText(error) };
  revalidatePath('/settings');
  return { ok: 'Settings saved' };
}
