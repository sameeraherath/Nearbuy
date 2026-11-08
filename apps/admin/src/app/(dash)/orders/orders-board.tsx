'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { formatRs, formatSriLankanMobile, type OrderStatus } from '@nearbuy/shared';
import { StatusBadge, Empty } from '@/components/ui';
import { assignOrders } from './actions';

export interface BoardOrder {
  id: string;
  number: string;
  status: OrderStatus;
  customer: string;
  phone: string;
  location: string;
  shop: string;
  shopId: string;
  items: string;
  total: number;
  shopTotal: number;
  rider: string | null;
  riderId: string | null;
}

export interface BoardRider {
  id: string;
  name: string;
  active: boolean;
}

const FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'placed', label: 'New' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'picked_up', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

const ASSIGNABLE: OrderStatus[] = ['placed', 'assigned'];

export function OrdersBoard({ orders, riders }: { orders: BoardOrder[]; riders: BoardRider[] }) {
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [shop, setShop] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [riderId, setRiderId] = useState<string>('');
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const shops = useMemo(() => {
    const m = new Map<string, string>();
    orders.forEach((o) => m.set(o.shopId, o.shop));
    return [...m.entries()];
  }, [orders]);

  const visible = orders.filter(
    (o) => (filter === 'all' || o.status === filter) && (shop === 'all' || o.shopId === shop),
  );
  const selectable = visible.filter((o) => ASSIGNABLE.includes(o.status));
  const allSelected = selectable.length > 0 && selectable.every((o) => selected.has(o.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function run(rider: string | null) {
    const ids = [...selected].filter((id) => orders.find((o) => o.id === id && ASSIGNABLE.includes(o.status)));
    startTransition(async () => {
      const res = await assignOrders(ids, rider);
      setMessage(res);
      if (res?.ok) setSelected(new Set());
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const n = f.key === 'all' ? orders.length : orders.filter((o) => o.status === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-sm ${
                filter === f.key ? 'border-navy bg-navy text-white' : 'border-line bg-white'
              }`}
            >
              {f.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
        <select className="input ml-auto w-auto" value={shop} onChange={(e) => setShop(e.target.value)}>
          <option value="all">All shops</option>
          {shops.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="card sticky top-2 z-10 flex flex-wrap items-center gap-2 border-primary p-3">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <select className="input w-auto" value={riderId} onChange={(e) => setRiderId(e.target.value)}>
            <option value="">Choose rider…</option>
            {riders
              .filter((r) => r.active)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
          <button className="btn-primary" disabled={!riderId || pending} onClick={() => run(riderId)}>
            Assign
          </button>
          <button className="btn-ghost" disabled={pending} onClick={() => run(null)}>
            Unassign
          </button>
          <button className="btn-ghost" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
      {message?.error && <p className="text-sm text-bad">{message.error}</p>}
      {message?.ok && <p className="text-sm text-ok">{message.ok}</p>}

      {visible.length === 0 ? (
        <Empty>No orders here.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr>
                <th className="th w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    disabled={selectable.length === 0}
                    onChange={() =>
                      setSelected(allSelected ? new Set() : new Set(selectable.map((o) => o.id)))
                    }
                  />
                </th>
                <th className="th">Order</th>
                <th className="th">Customer</th>
                <th className="th">Shop / items</th>
                <th className="th">Deliver to</th>
                <th className="th text-right">Collect</th>
                <th className="th">Rider</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => (
                <tr key={o.id} className={selected.has(o.id) ? 'bg-primary-tint/50' : ''}>
                  <td className="td">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      disabled={!ASSIGNABLE.includes(o.status)}
                      onChange={() => toggle(o.id)}
                    />
                  </td>
                  <td className="td">
                    <Link href={`/orders/${o.id}`} className="font-semibold text-navy underline">
                      {o.number}
                    </Link>
                    <div className="mt-1">
                      <StatusBadge status={o.status} />
                    </div>
                  </td>
                  <td className="td">
                    <div className="font-medium">{o.customer}</div>
                    <div className="text-xs text-muted">{formatSriLankanMobile(o.phone)}</div>
                  </td>
                  <td className="td">
                    <div className="font-medium">{o.shop}</div>
                    <div className="text-xs text-muted">{o.items}</div>
                  </td>
                  <td className="td text-xs">{o.location}</td>
                  <td className="td text-right font-semibold">{formatRs(o.total)}</td>
                  <td className="td text-sm">{o.rider ?? <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ShoppingList orders={orders} />
    </div>
  );
}

/** What riders need to buy from each shop for orders not yet picked up. */
function ShoppingList({ orders }: { orders: BoardOrder[] }) {
  const open = orders.filter((o) => o.status === 'placed' || o.status === 'assigned');
  if (open.length === 0) return null;
  const byShop = new Map<string, { name: string; orders: number; cost: number; numbers: string[] }>();
  for (const o of open) {
    const s = byShop.get(o.shopId) ?? { name: o.shop, orders: 0, cost: 0, numbers: [] };
    s.orders += 1;
    s.cost += o.shopTotal;
    s.numbers.push(o.number);
    byShop.set(o.shopId, s);
  }
  return (
    <div className="card p-4">
      <h2 className="mb-3 font-semibold">To pick up (not yet collected)</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...byShop.values()].map((s) => (
          <div key={s.name} className="rounded-xl border border-line p-3">
            <div className="font-medium">{s.name}</div>
            <div className="text-sm text-muted">
              {s.orders} order(s) · shop cost {formatRs(s.cost)}
            </div>
            <div className="mt-1 text-xs text-muted">{s.numbers.join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
