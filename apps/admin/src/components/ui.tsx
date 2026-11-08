import type { OrderStatus } from '@nearbuy/shared';

const STATUS_STYLE: Record<OrderStatus, string> = {
  placed: 'bg-primary-tint text-[#8a5300]',
  assigned: 'bg-blue-50 text-blue-800',
  picked_up: 'bg-purple-50 text-purple-800',
  delivered: 'bg-green-50 text-ok',
  cancelled: 'bg-red-50 text-bad',
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  assigned: 'Assigned',
  picked_up: 'Picked up',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-sm text-muted">{children}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="card border-bad/30 p-4 text-sm text-bad">{message}</div>;
}
