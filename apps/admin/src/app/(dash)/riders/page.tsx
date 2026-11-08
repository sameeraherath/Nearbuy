import { colomboDate, formatRs, formatSriLankanMobile } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { ErrorBox, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { createRider, updateRider } from './actions';

export default async function RidersPage() {
  const { supabase } = await requireAdmin();
  const today = colomboDate();
  const [{ data: riders, error }, { data: orders }] = await Promise.all([
    supabase.from('riders').select('*, profiles(full_name, phone, is_blocked)').order('created_at'),
    supabase
      .from('orders')
      .select('rider_id, status, total_to_collect, items_shop_total, rider_pay')
      .eq('delivery_date', today)
      .not('rider_id', 'is', null),
  ]);
  if (error) return <ErrorBox message={error.message} />;

  const stats = new Map<string, { open: number; delivered: number; cash: number; pay: number }>();
  for (const o of orders ?? []) {
    if (!o.rider_id) continue;
    const s = stats.get(o.rider_id) ?? { open: 0, delivered: 0, cash: 0, pay: 0 };
    if (o.status === 'delivered') {
      s.delivered += 1;
      s.cash += o.total_to_collect;
      s.pay += o.rider_pay;
    } else if (o.status !== 'cancelled') s.open += 1;
    stats.set(o.rider_id, s);
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Riders" />
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="th">Rider</th>
              <th className="th">Today</th>
              <th className="th">Vehicle / status</th>
            </tr>
          </thead>
          <tbody>
            {riders.map((r) => {
              const s = stats.get(r.profile_id);
              return (
                <tr key={r.profile_id}>
                  <td className="td">
                    <div className="font-medium">{r.profiles?.full_name}</div>
                    <div className="text-xs text-muted">
                      {r.profiles?.phone && formatSriLankanMobile(r.profiles.phone)}
                    </div>
                  </td>
                  <td className="td text-xs">
                    {s ? (
                      <>
                        {s.open} open · {s.delivered} delivered
                        <br />
                        Collected {formatRs(s.cash)} · Pay {formatRs(s.pay)}
                      </>
                    ) : (
                      <span className="text-muted">No orders</span>
                    )}
                  </td>
                  <td className="td">
                    <ActionForm action={updateRider} submitLabel="Save" submitClassName="btn-ghost" className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={r.profile_id} />
                      <input name="vehicle_note" className="input w-48" defaultValue={r.vehicle_note} placeholder="Bike · ABC-1234" />
                      <label className="flex items-center gap-1 text-sm">
                        <input type="checkbox" name="is_active" defaultChecked={r.is_active} /> Active
                      </label>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="card max-w-2xl p-4">
        <h2 className="mb-3 font-semibold">Add a rider</h2>
        <ActionForm action={createRider} submitLabel="Add rider" resetOnSuccess>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Name</label>
              <input name="full_name" className="input" required maxLength={60} />
            </div>
            <div>
              <label className="label">Mobile</label>
              <input name="phone" className="input" required placeholder="07X XXX XXXX" />
            </div>
            <div>
              <label className="label">Vehicle</label>
              <input name="vehicle_note" className="input" placeholder="Bike · ABC-1234" />
            </div>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
