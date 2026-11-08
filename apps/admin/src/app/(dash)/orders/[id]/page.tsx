import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatRs,
  formatSriLankanMobile,
  OVERRIDE_REASON_LABELS,
  OVERRIDE_REASONS,
  orderEarnings,
  type OrderStatus,
} from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { StatusBadge } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { RealtimeRefresh } from '@/components/realtime-refresh';
import { assignOne, cancelOrder, overrideDelivery } from '../actions';

const dt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const fmt = (s: string | null) => (s ? dt.format(new Date(s)) : '—');

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: order }, { data: items }, { data: code }, { data: events }, { data: riders }] =
    await Promise.all([
      supabase.from('orders').select('*, businesses(name, phone, area)').eq('id', id).maybeSingle(),
      supabase.from('order_items').select('*').eq('order_id', id),
      supabase.from('order_codes').select('code').eq('order_id', id).maybeSingle(),
      supabase.from('order_events').select('*, profiles(full_name)').eq('order_id', id).order('created_at'),
      supabase.from('riders').select('profile_id, is_active, profiles(full_name, phone)'),
    ]);
  if (!order) notFound();

  const status = order.status as OrderStatus;
  const rider = riders?.find((r) => r.profile_id === order.rider_id);
  const open = status !== 'delivered' && status !== 'cancelled';
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${order.location_lat},${order.location_lng}`;

  return (
    <div className="max-w-5xl">
      <RealtimeRefresh />
      <Link href={`/orders?date=${order.delivery_date}`} className="text-sm text-muted underline">
        ← Orders for {order.delivery_date}
      </Link>
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{order.order_number}</h1>
        <StatusBadge status={status} />
        {order.delivered_by_override && (
          <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-semibold text-yellow-800">
            Override: {order.override_reason && OVERRIDE_REASON_LABELS[order.override_reason]}
            {order.override_note ? ` — ${order.override_note}` : ''}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Items from {order.businesses?.name}</h2>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Item</th>
                  <th className="th text-right">Qty</th>
                  <th className="th text-right">Shop</th>
                  <th className="th text-right">Selling</th>
                </tr>
              </thead>
              <tbody>
                {items?.map((i) => (
                  <tr key={i.id} className={i.is_unavailable ? 'text-muted line-through' : ''}>
                    <td className="td">
                      {i.name}
                      {i.is_unavailable && <span className="ml-2 text-xs no-underline">(unavailable)</span>}
                    </td>
                    <td className="td text-right">{i.qty}</td>
                    <td className="td text-right">{formatRs(i.shop_price * i.qty)}</td>
                    <td className="td text-right">{formatRs(i.selling_price * i.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm sm:w-80 sm:ml-auto">
              <dt className="text-muted">Items</dt>
              <dd className="text-right">{formatRs(order.items_selling_total)}</dd>
              <dt className="text-muted">Delivery fee</dt>
              <dd className="text-right">{formatRs(order.delivery_fee)}</dd>
              <dt className="font-semibold">Collect in cash</dt>
              <dd className="text-right font-semibold">{formatRs(order.total_to_collect)}</dd>
              <dt className="text-muted">Shop cost</dt>
              <dd className="text-right">{formatRs(order.items_shop_total)}</dd>
              <dt className="text-muted">Rider pay</dt>
              <dd className="text-right">{formatRs(order.rider_pay)}</dd>
              {status === 'delivered' && (
                <>
                  <dt className="text-muted">Our earnings</dt>
                  <dd className="text-right">{formatRs(orderEarnings(order))}</dd>
                </>
              )}
            </dl>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">History</h2>
            <ol className="space-y-2 text-sm">
              {events?.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-28 shrink-0 text-muted">{fmt(e.created_at)}</span>
                  <span>
                    <span className="font-medium">{e.type.replaceAll('_', ' ')}</span>
                    {e.profiles?.full_name && <span className="text-muted"> by {e.profiles.full_name}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card space-y-2 p-4 text-sm">
            <h2 className="font-semibold">Customer</h2>
            <div>{order.customer_name}</div>
            <a className="text-navy underline" href={`tel:${order.customer_phone}`}>
              {formatSriLankanMobile(order.customer_phone)}
            </a>
            <div className="pt-2">
              <div className="font-medium">{order.location_label}</div>
              {order.location_room && <div>{order.location_room}</div>}
              {order.location_note && <div className="text-muted">“{order.location_note}”</div>}
              <a className="text-navy underline" href={mapUrl} target="_blank" rel="noreferrer">
                Open in Google Maps
              </a>
            </div>
            <div className="pt-2">
              <span className="text-muted">Delivery code: </span>
              <span className="font-mono text-lg font-bold tracking-widest">{code?.code ?? '—'}</span>
              {order.code_attempts > 0 && (
                <div className="text-xs text-bad">{order.code_attempts} wrong attempt(s)</div>
              )}
            </div>
            <div className="pt-2 text-xs text-muted">
              Placed {fmt(order.placed_at)} · Assigned {fmt(order.assigned_at)} · Picked up {fmt(order.picked_up_at)}{' '}
              · Delivered {fmt(order.delivered_at)}
            </div>
          </section>

          <section className="card space-y-3 p-4 text-sm">
            <h2 className="font-semibold">Rider</h2>
            <div>
              {rider ? (
                <>
                  {rider.profiles?.full_name} ·{' '}
                  {rider.profiles?.phone && formatSriLankanMobile(rider.profiles.phone)}
                </>
              ) : (
                <span className="text-muted">Not assigned</span>
              )}
            </div>
            {(status === 'placed' || status === 'assigned') && (
              <ActionForm action={assignOne} submitLabel="Save rider" className="space-y-2">
                <input type="hidden" name="order_id" value={order.id} />
                <select name="rider_id" className="input" defaultValue={order.rider_id ?? ''}>
                  <option value="">No rider</option>
                  {riders
                    ?.filter((r) => r.is_active)
                    .map((r) => (
                      <option key={r.profile_id} value={r.profile_id}>
                        {r.profiles?.full_name}
                      </option>
                    ))}
                </select>
              </ActionForm>
            )}
          </section>

          {(status === 'assigned' || status === 'picked_up') && (
            <section className="card p-4 text-sm">
              <h2 className="mb-2 font-semibold">Mark delivered without code</h2>
              <ActionForm
                action={overrideDelivery}
                submitLabel="Mark delivered"
                className="space-y-2"
                confirm="Mark this order as delivered without the code?"
              >
                <input type="hidden" name="order_id" value={order.id} />
                <select name="reason" className="input" defaultValue="">
                  <option value="" disabled>
                    Reason…
                  </option>
                  {OVERRIDE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {OVERRIDE_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
                <input name="note" className="input" placeholder="Note (required for Other)" maxLength={200} />
              </ActionForm>
            </section>
          )}

          {open && (
            <section className="card p-4 text-sm">
              <h2 className="mb-2 font-semibold">Cancel order</h2>
              <ActionForm
                action={cancelOrder}
                submitLabel="Cancel order"
                submitClassName="btn-danger"
                className="space-y-2"
                confirm="Cancel this order? The customer gets an SMS."
              >
                <input type="hidden" name="order_id" value={order.id} />
                <input name="reason" className="input" placeholder="Reason (e.g. shop closed)" />
              </ActionForm>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
