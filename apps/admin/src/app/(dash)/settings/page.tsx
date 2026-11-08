import { requireAdmin } from '@/lib/auth';
import { ErrorBox, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/action-form';
import { saveSettings } from './actions';
import { signOut } from '../actions';

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data: s, error } = await supabase.from('settings').select('*').eq('id', true).single();
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />
      <section className="card p-4">
        <ActionForm action={saveSettings} submitLabel="Save settings">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
              <input type="checkbox" name="ordering_enabled" defaultChecked={s.ordering_enabled} />
              Ordering enabled (turn off to close for the day)
            </label>
            <div>
              <label className="label">Daily cutoff (Sri Lanka time)</label>
              <input type="time" name="cutoff_time" className="input" defaultValue={s.cutoff_time.slice(0, 5)} />
            </div>
            <div>
              <label className="label">Delivery window text</label>
              <input name="delivery_window_text" className="input" defaultValue={s.delivery_window_text} />
            </div>
            <div>
              <label className="label">Delivery fee (Rs)</label>
              <input type="number" min={0} name="delivery_fee" className="input" defaultValue={s.delivery_fee} />
            </div>
            <div>
              <label className="label">Minimum order (Rs)</label>
              <input type="number" min={0} name="min_order_amount" className="input" defaultValue={s.min_order_amount} />
            </div>
            <div>
              <label className="label">Free delivery over (Rs, blank = off)</label>
              <input type="number" min={0} name="free_delivery_over" className="input" defaultValue={s.free_delivery_over ?? ''} />
            </div>
            <div>
              <label className="label">Free delivery until (blank = no end)</label>
              <input type="date" name="free_delivery_until" className="input" defaultValue={s.free_delivery_until ?? ''} />
            </div>
            <div>
              <label className="label">Rider pay per delivery (Rs)</label>
              <input type="number" min={0} name="rider_pay_per_delivery" className="input" defaultValue={s.rider_pay_per_delivery} />
            </div>
            <div>
              <label className="label">Help phone shown to customers</label>
              <input name="help_phone" className="input" defaultValue={s.help_phone} />
            </div>
          </div>
        </ActionForm>
      </section>
      <form action={signOut} className="mt-6">
        <button className="btn-ghost">Sign out</button>
      </form>
    </div>
  );
}
