import Link from 'next/link';
import { notFound } from 'next/navigation';
import { STORAGE_BUCKETS } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { ActionForm } from '@/components/action-form';
import { PhotoUpload } from '@/components/photo-upload';
import { createFood, setShopCover, updateShop } from '../actions';
import { ShopFields } from '../shop-fields';
import { FoodFields, FoodRow } from './food-row';

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: shop }, { data: foods }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).maybeSingle(),
    supabase.from('foods').select('*').eq('business_id', id).order('category').order('sort_order').order('name'),
  ]);
  if (!shop) notFound();
  const categories = [...new Set((foods ?? []).map((f) => f.category))];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/shops" className="text-sm text-muted underline">
          ← All shops
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{shop.name}</h1>
      </div>

      <section className="card p-4">
        <div className="mb-4">
          <PhotoUpload
            bucket={STORAGE_BUCKETS.businessCovers}
            folder={shop.id}
            current={shop.cover_photo_path}
            onSaved={setShopCover.bind(null, shop.id)}
            label="Cover photo"
          />
        </div>
        <ActionForm action={updateShop} submitLabel="Save shop">
          <input type="hidden" name="id" value={shop.id} />
          <ShopFields shop={shop} />
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Menu ({foods?.length ?? 0})</h2>
        <div className="space-y-2">
          {foods?.map((f) => <FoodRow key={f.id} food={f} />)}
        </div>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-semibold">Add a food</h2>
        <ActionForm action={createFood} submitLabel="Add food" resetOnSuccess>
          <input type="hidden" name="business_id" value={shop.id} />
          <FoodFields categories={categories} />
        </ActionForm>
      </section>
    </div>
  );
}
