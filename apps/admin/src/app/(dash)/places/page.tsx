import { requireAdmin } from '@/lib/auth';
import { ErrorBox, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { deletePlace, savePlace } from './actions';

function Fields({ p }: { p?: { name: string; lat: number; lng: number; sort_order: number } }) {
  return (
    <div className="grid flex-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_80px]">
      <input name="name" className="input" placeholder="Name" required defaultValue={p?.name} />
      <input name="lat" className="input" placeholder="Latitude" required inputMode="decimal" defaultValue={p?.lat} />
      <input name="lng" className="input" placeholder="Longitude" required inputMode="decimal" defaultValue={p?.lng} />
      <input name="sort_order" type="number" className="input" placeholder="Sort" defaultValue={p?.sort_order ?? 0} />
    </div>
  );
}

export default async function PlacesPage() {
  const { supabase } = await requireAdmin();
  const { data: places, error } = await supabase.from('places').select('*').order('sort_order').order('name');
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Delivery places" />
      <p className="mb-4 text-sm text-muted">
        Customers pick one of these as their delivery point. Tip: in Google Maps, long-press a spot to copy its
        coordinates.
      </p>
      <div className="space-y-2">
        {places.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-start gap-2 p-3">
            <ActionForm action={savePlace} submitLabel="Save" submitClassName="btn-ghost" className="flex flex-1 flex-wrap items-start gap-2">
              <input type="hidden" name="id" value={p.id} />
              <Fields p={p} />
            </ActionForm>
            <a
              className="btn-ghost"
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
            >
              Map
            </a>
            <ActionForm action={deletePlace} submitLabel="Delete" submitClassName="btn-danger" confirm={`Delete ${p.name}?`}>
              <input type="hidden" name="id" value={p.id} />
            </ActionForm>
          </div>
        ))}
      </div>
      <section className="card mt-6 p-4">
        <h2 className="mb-3 font-semibold">Add a place</h2>
        <ActionForm action={savePlace} submitLabel="Add place" resetOnSuccess className="flex flex-wrap items-start gap-2">
          <Fields />
        </ActionForm>
      </section>
    </div>
  );
}
