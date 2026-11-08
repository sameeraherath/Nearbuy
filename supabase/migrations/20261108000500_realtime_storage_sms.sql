-- Realtime broadcast, storage buckets, and SMS dispatch plumbing.

-- ---------------------------------------------------------------------------
-- Realtime: broadcast order changes on private channels.
--   order:<order_id>   → the order's customer (tracking screen)
--   rider:<rider_id>   → the assigned rider (also the previous rider on reassignment)
--   admin:orders       → admins
-- Payloads carry only ids and status; apps refetch through RLS-protected reads.
-- ---------------------------------------------------------------------------
create or replace function private.broadcast_order_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object(
    'id', new.id, 'order_number', new.order_number, 'status', new.status,
    'rider_id', new.rider_id, 'delivery_date', new.delivery_date);
begin
  perform realtime.send(v_payload, 'order_changed', 'order:' || new.id::text, true);
  perform realtime.send(v_payload, 'order_changed', 'admin:orders', true);
  if new.rider_id is not null then
    perform realtime.send(v_payload, 'order_changed', 'rider:' || new.rider_id::text, true);
  end if;
  if tg_op = 'UPDATE' and old.rider_id is not null and old.rider_id is distinct from new.rider_id then
    perform realtime.send(v_payload, 'order_changed', 'rider:' || old.rider_id::text, true);
  end if;
  return null;
end;
$$;

create trigger orders_broadcast
  after insert or update on public.orders
  for each row execute function private.broadcast_order_change();

-- Items changing (unavailable) also changes what the rider/customer see.
create or replace function private.broadcast_order_item_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('id', new.order_id), 'order_changed', 'order:' || new.order_id::text, true);
  return null;
end;
$$;

create trigger order_items_broadcast
  after update on public.order_items
  for each row execute function private.broadcast_order_item_change();

-- realtime.messages already has RLS enabled by Supabase.
create policy nearbuy_realtime_customer on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() ~ '^order:[0-9a-f-]{36}$'
    and (select private.owns_order(substr(realtime.topic(), 7)::uuid))
  );

create policy nearbuy_realtime_rider on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'rider:' || (select auth.uid())::text
  );

create policy nearbuy_realtime_admin on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'admin:orders'
    and (select private.is_admin())
  );

-- ---------------------------------------------------------------------------
-- Storage: public-read buckets for photos; only admins write.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('business-covers', 'business-covers', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('food-photos', 'food-photos', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy nearbuy_photos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id in ('business-covers', 'food-photos') and (select private.is_admin()));
create policy nearbuy_photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id in ('business-covers', 'food-photos') and (select private.is_admin()))
  with check (bucket_id in ('business-covers', 'food-photos') and (select private.is_admin()));
create policy nearbuy_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('business-covers', 'food-photos') and (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- SMS dispatch: the sms-dispatch Edge Function (service role) claims queued rows,
-- sends them through the configured provider and records the result.
-- ---------------------------------------------------------------------------
create or replace function public.sms_claim_batch(p_limit integer default 20)
returns setof public.sms_messages
language sql security definer set search_path = ''
as $$
  update public.sms_messages m
     set status = 'sending', attempts = m.attempts + 1, status_updated_at = now()
   where m.id in (
     select id from public.sms_messages
      where status = 'queued'
         or (status = 'sending' and status_updated_at < now() - interval '5 minutes' and attempts < 5)
      order by created_at
      limit greatest(1, least(p_limit, 100))
      for update skip locked
   )
  returning m.*;
$$;

create or replace function public.sms_record_result(
  p_id uuid, p_ok boolean, p_provider text, p_provider_message_id text default null, p_error text default null
)
returns void
language sql security definer set search_path = ''
as $$
  update public.sms_messages
     set status = case
           when p_ok then 'sent'::public.sms_status
           when attempts >= 5 then 'failed'::public.sms_status
           else 'queued'::public.sms_status
         end,
         provider = p_provider,
         provider_message_id = coalesce(p_provider_message_id, provider_message_id),
         error = p_error,
         sent_at = case when p_ok then now() else sent_at end,
         status_updated_at = now()
   where id = p_id;
$$;

revoke all on function public.sms_claim_batch(integer) from public, anon, authenticated;
revoke all on function public.sms_record_result(uuid, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.sms_claim_batch(integer) to service_role;
grant execute on function public.sms_record_result(uuid, boolean, text, text, text) to service_role;

-- Kick the dispatcher right after an SMS is queued (async via pg_net), plus a
-- once-a-minute sweep via pg_cron as a safety net. Both read the function URL and
-- secret from Vault and do nothing if they're not configured (e.g. in tests).
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/sms-dispatch', 'sms_dispatch_url');
--   select vault.create_secret('<random secret>', 'sms_dispatch_secret');
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function private.kick_sms_dispatch()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'sms_dispatch_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sms_dispatch_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;

create or replace function private.on_sms_queued()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.kick_sms_dispatch();
  return null;
end;
$$;

create trigger sms_messages_kick
  after insert on public.sms_messages
  for each statement execute function private.on_sms_queued();

select cron.schedule(
  'nearbuy-sms-sweep', '* * * * *',
  $$select private.kick_sms_dispatch()
    where exists (select 1 from public.sms_messages where status in ('queued', 'sending'))$$
);
