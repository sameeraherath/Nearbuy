'use server';

import { revalidatePath } from 'next/cache';
import { OVERRIDE_REASONS, type OverrideReason } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { errorText, str, type ActionState } from '@/lib/actions';

export async function assignOrders(orderIds: string[], riderId: string | null): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  if (orderIds.length === 0) return { error: 'Select at least one order' };
  const { data, error } = await supabase.rpc('assign_orders', {
    p_order_ids: orderIds,
    // null unassigns; the generated type doesn't mark it nullable
    p_rider_id: riderId as string,
  });
  if (error) return { error: errorText(error) };
  revalidatePath('/orders');
  return { ok: riderId ? `Assigned ${data} order(s)` : `Unassigned ${data} order(s)` };
}

export async function cancelOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'order_id');
  const { error } = await supabase.rpc('admin_cancel_order', {
    p_order_id: id,
    p_reason: str(form, 'reason') || undefined,
  });
  if (error) return { error: errorText(error) };
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return { ok: 'Order cancelled' };
}

export async function overrideDelivery(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'order_id');
  const reason = str(form, 'reason') as OverrideReason;
  if (!OVERRIDE_REASONS.includes(reason)) return { error: 'Please choose a reason' };
  const note = str(form, 'note');
  if (reason === 'other' && !note) return { error: 'Please describe the reason' };
  const { error } = await supabase.rpc('admin_override_delivery', {
    p_order_id: id,
    p_reason: reason,
    p_note: note || undefined,
  });
  if (error) return { error: errorText(error) };
  revalidatePath('/orders');
  revalidatePath(`/orders/${id}`);
  return { ok: 'Marked as delivered' };
}

export async function assignOne(_: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form, 'order_id');
  const rider = str(form, 'rider_id');
  const res = await assignOrders([id], rider || null);
  revalidatePath(`/orders/${id}`);
  return res;
}
