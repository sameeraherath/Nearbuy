'use client';

import { useState, useTransition } from 'react';
import { formatRs, STORAGE_BUCKETS, type Tables } from '@nearbuy/shared';
import { ActionForm } from '@/components/action-form';
import { PhotoUpload, publicPhotoUrl } from '@/components/photo-upload';
import { deleteFood, setFoodPhoto, toggleFood, updateFood } from '../actions';

type Food = Tables<'foods'>;

export function FoodFields({ food, categories = [] }: { food?: Food; categories?: string[] }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-3">
        <label className="label">Name</label>
        <input name="name" className="input" required maxLength={80} defaultValue={food?.name} />
      </div>
      <div className="sm:col-span-3">
        <label className="label">Category</label>
        <input
          name="category"
          className="input"
          list="categories"
          maxLength={40}
          defaultValue={food?.category ?? ''}
          placeholder="e.g. Kottu, Rice, Drinks"
        />
        <datalist id="categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div className="sm:col-span-6">
        <label className="label">Description</label>
        <input name="description" className="input" maxLength={300} defaultValue={food?.description} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Shop price (Rs)</label>
        <input name="shop_price" type="number" min={0} className="input" required defaultValue={food?.shop_price} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Selling price (Rs)</label>
        <input
          name="selling_price"
          type="number"
          min={0}
          className="input"
          required
          defaultValue={food?.selling_price}
        />
      </div>
      <div className="sm:col-span-1">
        <label className="label">Sort</label>
        <input name="sort_order" type="number" className="input" defaultValue={food?.sort_order ?? 0} />
      </div>
      <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-1">
        <input type="checkbox" name="is_available" defaultChecked={food?.is_available ?? true} />
        Available
      </label>
    </div>
  );
}

export function FoodRow({ food }: { food: Food }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const photo = publicPhotoUrl(STORAGE_BUCKETS.foodPhotos, food.photo_path);

  if (editing) {
    return (
      <div className="card space-y-3 border-primary p-4">
        <PhotoUpload
          bucket={STORAGE_BUCKETS.foodPhotos}
          folder={food.business_id}
          current={food.photo_path}
          onSaved={(path) => setFoodPhoto(food.id, food.business_id, path)}
        />
        <ActionForm action={updateFood} submitLabel="Save">
          <input type="hidden" name="id" value={food.id} />
          <input type="hidden" name="business_id" value={food.business_id} />
          <FoodFields food={food} />
        </ActionForm>
        <div className="flex gap-2 border-t border-line pt-3">
          <button className="btn-ghost" onClick={() => setEditing(false)}>
            Done
          </button>
          <ActionForm
            action={deleteFood}
            submitLabel="Delete food"
            submitClassName="btn-danger"
            confirm={`Delete ${food.name}? Past orders keep their item names.`}
          >
            <input type="hidden" name="id" value={food.id} />
            <input type="hidden" name="business_id" value={food.business_id} />
          </ActionForm>
        </div>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-3 p-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {food.name} <span className="text-xs font-normal text-muted">· {food.category}</span>
        </div>
        <div className="truncate text-xs text-muted">{food.description}</div>
      </div>
      <div className="text-right text-sm">
        <div className="font-semibold">{formatRs(food.selling_price)}</div>
        <div className="text-xs text-muted">shop {formatRs(food.shop_price)}</div>
      </div>
      <button
        className={`btn text-xs ${food.is_available ? 'bg-green-50 text-ok' : 'bg-red-50 text-bad'}`}
        disabled={pending}
        onClick={() => start(() => toggleFood(food.id, food.business_id, !food.is_available))}
        title="Toggle availability"
      >
        {food.is_available ? 'Available' : 'Sold out'}
      </button>
      <button className="btn-ghost text-xs" onClick={() => setEditing(true)}>
        Edit
      </button>
    </div>
  );
}
