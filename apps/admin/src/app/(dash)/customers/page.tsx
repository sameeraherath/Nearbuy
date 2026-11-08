import { formatSriLankanMobile } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { ErrorBox, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { setBlocked } from './actions';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { supabase } = await requireAdmin();
  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, is_blocked, created_at, orders!orders_customer_id_fkey(count)')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })
    .limit(200);
  const term = q.trim().replace(/[%,()]/g, '');
  if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term.replace(/^0/, '')}%`);
  const { data: customers, error } = await query;
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Customers">
        <form>
          <input name="q" defaultValue={q} className="input w-64" placeholder="Search name or number" />
        </form>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="th">Customer</th>
              <th className="th">Joined</th>
              <th className="th text-right">Orders</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td className="td">
                  <div className="font-medium">
                    {c.full_name || <span className="text-muted">No name</span>}
                    {c.is_blocked && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-bad">Blocked</span>
                    )}
                  </div>
                  <div className="text-xs text-muted">{formatSriLankanMobile(c.phone)}</div>
                </td>
                <td className="td text-xs">{c.created_at.slice(0, 10)}</td>
                <td className="td text-right">{c.orders[0]?.count ?? 0}</td>
                <td className="td text-right">
                  <ActionForm
                    action={setBlocked}
                    submitLabel={c.is_blocked ? 'Unblock' : 'Block'}
                    submitClassName={c.is_blocked ? 'btn-ghost' : 'btn-danger'}
                    confirm={c.is_blocked ? undefined : `Block ${c.full_name || c.phone}? They won't be able to order.`}
                  >
                    <input type="hidden" name="phone" value={c.phone} />
                    <input type="hidden" name="blocked" value={c.is_blocked ? 'false' : 'true'} />
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
