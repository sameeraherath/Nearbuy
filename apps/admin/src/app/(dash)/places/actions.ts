'use server';

import { revalidatePath } from 'next/cache';
import { placeSchema } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { errorText, int, str, type ActionState } from '@/lib/actions';

function parse(form: FormData) {
  return placeSchema.safeParse({
    name: str(form, 'name'),
    lat: Number(str(form, 'lat')),
    lng: Number(str(form, 'lng')),
    sort_order: int(form, 'sort_order') ?? 0,
  });
}

export async function savePlace(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid place' };
  const id = str(form, 'id');
  const { error } = id
    ? await supabase.from('places').update(parsed.data).eq('id', id)
    : await supabase.from('places').insert(parsed.data);
  if (error) return { error: errorText(error) };
  revalidatePath('/places');
  return { ok: id ? 'Saved' : 'Added' };
}

export async function deletePlace(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('places').delete().eq('id', str(form, 'id'));
  if (error) return { error: errorText(error) };
  revalidatePath('/places');
  return { ok: 'Deleted' };
}
