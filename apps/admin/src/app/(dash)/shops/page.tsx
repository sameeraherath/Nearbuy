import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { Empty, ErrorBox, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { createShop } from './actions';
import { ShopFields } from './shop-fields';

export default async function ShopsPage() {
  const { supabase } = await requireAdmin();
  const { data: shops, error } = await supabase
    .from('businesses')
    .select('id, name, area, is_active, cuisine_tags, sort_order, foods(id, is_available)')
    .order('sort_order')
    .order('name');
  if (error) return <ErrorBox message={error.message} />;

  return (
    <>
      <PageHeader title="Shops & menus" />
      {shops.length === 0 ? (
        <Empty>No shops yet. Add one below.</Empty>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shops.map((s) => (
            <Link key={s.id} href={`/shops/${s.id}`} className="card block p-4 hover:border-primary">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{s.name}</div>
                {!s.is_active && (
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">Hidden</span>
                )}
              </div>
              <div className="text-sm text-muted">{s.area}</div>
              <div className="mt-2 text-xs text-muted">
                {s.foods.length} items · {s.foods.filter((f) => f.is_available).length} available
                {s.cuisine_tags.length > 0 && ` · ${s.cuisine_tags.join(', ')}`}
              </div>
            </Link>
          ))}
        </div>
      )}

      <section className="card max-w-3xl p-4">
        <h2 className="mb-3 font-semibold">Add a shop</h2>
        <ActionForm action={createShop} submitLabel="Add shop">
          <ShopFields />
        </ActionForm>
      </section>
    </>
  );
}
