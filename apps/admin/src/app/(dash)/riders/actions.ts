'use server';

import { revalidatePath } from 'next/cache';
import { riderSchema } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { bool, errorText, str, type ActionState } from '@/lib/actions';

export async function createRider(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = riderSchema.safeParse({
    full_name: str(form, 'full_name'),
    phone: str(form, 'phone'),
    vehicle_note: str(form, 'vehicle_note'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid rider' };
  const { full_name, phone, vehicle_note } = parsed.data;

  let service;
  try {
    service = createServiceClient();
  } catch {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' };
  }

  const { data: existing } = await service
    .from('profiles')
    .select('id, role')
    .eq('phone', phone)
    .maybeSingle();
  if (existing) {
    return {
      error:
        existing.role === 'rider'
          ? 'This number is already a rider'
          : `This number is already registered as a ${existing.role}`,
    };
  }

  // The role lives in app_metadata, which only the service role can set.
  const { data: created, error } = await service.auth.admin.createUser({
    phone,
    phone_confirm: true,
    app_metadata: { role: 'rider', full_name },
  });
  if (error || !created.user) return { error: error?.message ?? 'Could not create the account' };

  // Supabase Auth inserts the user first and attaches app_metadata afterwards, so the
  // profile trigger files the new account as a customer with no name. Set it explicitly.
  const { error: profileError } = await service
    .from('profiles')
    .update({ role: 'rider', full_name })
    .eq('id', created.user.id);
  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    return { error: errorText(profileError) };
  }

  const { error: riderError } = await service
    .from('riders')
    .insert({ profile_id: created.user.id, vehicle_note });
  if (riderError) return { error: errorText(riderError) };

  revalidatePath('/riders');
  return { ok: `${full_name} added. They can now sign in to the rider app.` };
}

export async function updateRider(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'id');
  const fullName = str(form, 'full_name');
  if (!fullName || fullName.length > 60) return { error: 'Name is required (max 60 characters)' };

  const { error } = await supabase
    .from('riders')
    .update({ vehicle_note: str(form, 'vehicle_note'), is_active: bool(form, 'is_active') })
    .eq('profile_id', id);
  if (error) return { error: errorText(error) };

  // Profiles are not writable through the API (role/is_blocked safety), so names go via the service role.
  try {
    const { error: nameError } = await createServiceClient()
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', id)
      .eq('role', 'rider');
    if (nameError) return { error: errorText(nameError) };
  } catch {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' };
  }

  revalidatePath('/riders');
  return { ok: 'Saved' };
}

/**
 * Removes a rider completely (login + profile). Riders who already have orders are kept for
 * the records — untick "Active" for them instead.
 */
export async function deleteRider(_: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = str(form, 'id');
  let service;
  try {
    service = createServiceClient();
  } catch {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server' };
  }

  const { count, error: countError } = await service
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('rider_id', id);
  if (countError) return { error: errorText(countError) };
  if ((count ?? 0) > 0) {
    return {
      error: `This rider has ${count} order(s) on record, so they can't be deleted. Untick "Active" instead.`,
    };
  }

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', id)
    .maybeSingle();
  if (profile?.role !== 'rider') return { error: 'Only rider accounts can be deleted here' };

  // Deleting the auth user cascades to profiles → riders → rider_locations.
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) return { error: error.message };
  revalidatePath('/riders');
  return { ok: 'Rider deleted' };
}
