import Link from 'next/link';
import { colomboDate, formatRs, orderEarnings, type OrderStatus } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { ErrorBox, PageHeader, Stat } from '@/components/ui';
import { RealtimeRefresh } from '@/components/realtime-refresh';
import { OrdersBoard, type BoardOrder, type BoardRider } from './orders-board';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const today = colomboDate();
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const { supabase } = await requireAdmin();

  const [ordersRes, ridersRes] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, order_number, status, customer_name, customer_phone, location_label, location_room, total_to_collect, items_selling_total, items_shop_total, delivery_fee, rider_pay, rider_id, placed_at, business_id, businesses(name), order_items(name, qty, is_unavailable)',
      )
      .eq('delivery_date', date)
      .order('placed_at'),
    supabase
      .from('riders')
      .select('profile_id, is_active, vehicle_note, profiles(full_name, phone)')
      .order('created_at'),
  ]);

  if (ordersRes.error) return <ErrorBox message={ordersRes.error.message} />;
  const orders = ordersRes.data;
  const riders: BoardRider[] = (ridersRes.data ?? []).map((r) => ({
    id: r.profile_id,
    name: r.profiles?.full_name || r.profiles?.phone || 'Rider',
    active: r.is_active,
  }));
  const riderName = new Map(riders.map((r) => [r.id, r.name]));

  const live = orders.filter((o) => o.status !== 'cancelled');
  const delivered = orders.filter((o) => o.status === 'delivered');
  const counts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  const board: BoardOrder[] = orders.map((o) => ({
    id: o.id,
    number: o.order_number,
    status: o.status as OrderStatus,
    customer: o.customer_name,
    phone: o.customer_phone,
    location: [o.location_label, o.location_room].filter(Boolean).join(' · '),
    shop: o.businesses?.name ?? '—',
    shopId: o.business_id,
    items: o.order_items
      .filter((i) => !i.is_unavailable)
      .map((i) => `${i.qty}× ${i.name}`)
      .join(', '),
    total: o.total_to_collect,
    shopTotal: o.items_shop_total,
    rider: o.rider_id ? (riderName.get(o.rider_id) ?? 'Rider') : null,
    riderId: o.rider_id,
  }));

  return (
    <>
      <RealtimeRefresh />
      <PageHeader title="Orders">
        <form className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} className="input w-auto" />
          <button className="btn-ghost">Go</button>
          {date !== today && (
            <Link href="/orders" className="btn-ghost">
              Today
            </Link>
          )}
        </form>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Orders"
          value={live.length}
          hint={`${counts.placed ?? 0} new · ${counts.assigned ?? 0} assigned · ${counts.picked_up ?? 0} on the way · ${counts.cancelled ?? 0} cancelled`}
        />
        <Stat label="Cash to collect" value={formatRs(live.reduce((s, o) => s + o.total_to_collect, 0))} />
        <Stat
          label="Pay shops"
          value={formatRs(live.reduce((s, o) => s + o.items_shop_total, 0))}
          hint="What riders spend at shops"
        />
        <Stat
          label="Earnings (delivered)"
          value={formatRs(delivered.reduce((s, o) => s + orderEarnings(o), 0))}
          hint={`${delivered.length} delivered`}
        />
      </div>

      <OrdersBoard orders={board} riders={riders} />
    </>
  );
}
