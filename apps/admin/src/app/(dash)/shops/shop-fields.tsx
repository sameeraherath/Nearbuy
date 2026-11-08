type Shop = {
  name: string;
  area: string;
  phone: string | null;
  cuisine_tags: string[];
  is_active: boolean;
  sort_order: number;
};

export function ShopFields({ shop }: { shop?: Shop }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Name</label>
        <input name="name" className="input" required maxLength={80} defaultValue={shop?.name} />
      </div>
      <div>
        <label className="label">Area</label>
        <input name="area" className="input" maxLength={80} defaultValue={shop?.area} />
      </div>
      <div>
        <label className="label">Shop phone (for riders/admin)</label>
        <input name="phone" className="input" placeholder="07X XXX XXXX" defaultValue={shop?.phone ?? ''} />
      </div>
      <div>
        <label className="label">Cuisine tags (comma separated)</label>
        <input name="cuisine_tags" className="input" defaultValue={shop?.cuisine_tags.join(', ')} />
      </div>
      <div>
        <label className="label">Sort order</label>
        <input name="sort_order" type="number" className="input" defaultValue={shop?.sort_order ?? 0} />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={shop?.is_active ?? true} />
        Visible to customers
      </label>
    </div>
  );
}
