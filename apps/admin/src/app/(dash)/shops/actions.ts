'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { businessSchema, foodSchema, STORAGE_BUCKETS } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { bool, errorText, int, str, type ActionState } from '@/lib/actions';

function shopFromForm(form: FormData) {
  return businessSchema.safeParse({
    name: str(form, 'name'),
    area: str(form, 'area'),
    phone: str(form, 'phone'),
    cuisine_tags: str(form, 'cuisine_tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    is_active: bool(form, 'is_active'),
    sort_order: int(form, 'sort_order') ?? 0,
  });
}

export async function createShop(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = shopFromForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid shop' };
  const { data, error } = await supabase
    .from('businesses')
    .insert({ ...parsed.data, phone: parsed.data.phone || null })
    .select('id')
    .single();
  if (error) return { error: errorText(error) };
  revalidatePath('/shops');
  redirect(`/shops/${data.id}`);
}

export async function updateShop(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'id');
  const parsed = shopFromForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid shop' };
  const { error } = await supabase
    .from('businesses')
    .update({ ...parsed.data, phone: parsed.data.phone || null })
    .eq('id', id);
  if (error) return { error: errorText(error) };
  revalidatePath('/shops');
  revalidatePath(`/shops/${id}`);
  return { ok: 'Saved' };
}

export async function setShopCover(id: string, path: string | null) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('businesses').update({ cover_photo_path: path }).eq('id', id);
  revalidatePath(`/shops/${id}`);
  return error ? { error: errorText(error) } : null;
}

function foodFromForm(form: FormData) {
  return foodSchema.safeParse({
    business_id: str(form, 'business_id'),
    name: str(form, 'name'),
    description: str(form, 'description'),
    category: str(form, 'category') || 'Other',
    shop_price: int(form, 'shop_price') ?? -1,
    selling_price: int(form, 'selling_price') ?? -1,
    is_available: bool(form, 'is_available'),
    sort_order: int(form, 'sort_order') ?? 0,
  });
}

export async function createFood(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = foodFromForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid food' };
  const { error } = await supabase.from('foods').insert(parsed.data);
  if (error) return { error: errorText(error) };
  revalidatePath(`/shops/${parsed.data.business_id}`);
  return { ok: 'Added' };
}

export async function updateFood(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'id');
  const parsed = foodFromForm(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid food' };
  const { error } = await supabase.from('foods').update(parsed.data).eq('id', id);
  if (error) return { error: errorText(error) };
  revalidatePath(`/shops/${parsed.data.business_id}`);
  return { ok: 'Saved' };
}

export async function toggleFood(id: string, businessId: string, available: boolean) {
  const { supabase } = await requireAdmin();
  await supabase.from('foods').update({ is_available: available }).eq('id', id);
  revalidatePath(`/shops/${businessId}`);
}

export async function deleteFood(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'id');
  const businessId = str(form, 'business_id');
  const { error } = await supabase.from('foods').delete().eq('id', id);
  if (error) return { error: errorText(error) };
  revalidatePath(`/shops/${businessId}`);
  return { ok: 'Deleted' };
}

export async function setFoodPhoto(id: string, businessId: string, path: string | null) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('foods').update({ photo_path: path }).eq('id', id);
  revalidatePath(`/shops/${businessId}`);
  return error ? { error: errorText(error) } : null;
}

/**
 * Deletes a shop with its menu and photos. Shops that already have orders are kept for the
 * order history — untick "Visible to customers" to hide them instead.
 */
export async function deleteShop(_: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'id');

  const { count, error: countError } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', id);
  if (countError) return { error: errorText(countError) };
  if ((count ?? 0) > 0) {
    return {
      error: `This shop has ${count} order(s) on record, so it can't be deleted. Untick "Visible to customers" to hide it instead.`,
    };
  }

  // Remember its photo files, then remove them once the shop is gone (best effort).
  const [{ data: shop }, { data: foods }] = await Promise.all([
    supabase.from('businesses').select('cover_photo_path').eq('id', id).maybeSingle(),
    supabase.from('foods').select('photo_path').eq('business_id', id).not('photo_path', 'is', null),
  ]);

  // Foods are removed with the shop (on delete cascade).
  const { error } = await supabase.from('businesses').delete().eq('id', id);
  if (error) return { error: errorText(error) };

  if (shop?.cover_photo_path) {
    await supabase.storage.from(STORAGE_BUCKETS.businessCovers).remove([shop.cover_photo_path]);
  }
  const foodPhotos = (foods ?? []).map((f) => f.photo_path).filter((p): p is string => !!p);
  if (foodPhotos.length > 0) await supabase.storage.from(STORAGE_BUCKETS.foodPhotos).remove(foodPhotos);

  revalidatePath('/shops');
  redirect('/shops');
}
