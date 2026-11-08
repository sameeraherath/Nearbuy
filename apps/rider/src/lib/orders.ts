import type { Tables } from '@nearbuy/shared';
import { supabase } from './supabase';

export type RiderOrder = Tables<'orders'> & { items: Tables<'order_items'>[]; shopName: string };

/** Today's orders assigned to the signed-in rider (RLS limits rows to their own). */
export async function fetchMyOrders(riderId: string, today: string): Promise<RiderOrder[]> {
  const [orders, shops] = await Promise.all([
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('rider_id', riderId)
      .eq('delivery_date', today)
      .order('placed_at'),
    supabase.from('shops').select('id, name'),
  ]);
  if (orders.error) throw orders.error;
  const names = new Map((shops.data ?? []).map((s) => [s.id, s.name]));
  return orders.data.map(({ order_items, ...o }) => ({
    ...o,
    items: order_items,
    shopName: names.get(o.business_id) ?? 'Shop',
  }));
}
