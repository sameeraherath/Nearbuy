import { formatSriLankanMobile } from '@nearbuy/shared';
import { requireAdmin } from '@/lib/auth';
import { Empty, ErrorBox, PageHeader } from '@/components/ui';

const dt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-primary-tint text-[#8a5300]',
  sending: 'bg-blue-50 text-blue-800',
  sent: 'bg-green-50 text-ok',
  delivered: 'bg-green-50 text-ok',
  failed: 'bg-red-50 text-bad',
  undelivered: 'bg-red-50 text-bad',
};

export default async function SmsPage() {
  const { supabase } = await requireAdmin();
  const { data: rows, error } = await supabase
    .from('sms_messages')
    .select('id, kind, to_phone, body, status, error, attempts, created_at')
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="max-w-5xl">
      <PageHeader title="SMS log" />
      {rows.length === 0 ? (
        <Empty>No messages yet.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr>
                <th className="th">When</th>
                <th className="th">To</th>
                <th className="th">Message</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="td whitespace-nowrap text-xs">{dt.format(new Date(m.created_at))}</td>
                  <td className="td whitespace-nowrap text-xs">{formatSriLankanMobile(m.to_phone)}</td>
                  <td className="td text-xs">
                    <div className="text-muted">{m.kind.replaceAll('_', ' ')}</div>
                    {m.body}
                    {m.error && <div className="text-bad">{m.error}</div>}
                  </td>
                  <td className="td">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[m.status] ?? ''}`}>
                      {m.status}
                    </span>
                    {m.attempts > 1 && <div className="text-xs text-muted">{m.attempts} tries</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
