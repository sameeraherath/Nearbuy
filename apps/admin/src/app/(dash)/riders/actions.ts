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

  const { data: existing } = await service.from('profiles').select('id, role').eq('phone', phone).maybeSingle();
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

  const { error: riderError } = await service
    .from('riders')
    .insert({ profile_id: created.user.id, vehicle_note });
  if (riderError) return { error: errorText(riderError) };

  revalidatePath('/riders');
  return { ok: `${full_name} added. They can now sign in to the rider app.` };
}

export async function updateRider(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from('riders')
    .update({ vehicle_note: str(form, 'vehicle_note'), is_active: bool(form, 'is_active') })
    .eq('profile_id', str(form, 'id'));
  if (error) return { error: errorText(error) };
  revalidatePath('/riders');
  return { ok: 'Saved' };
}
