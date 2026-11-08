-- Row Level Security and privileges.
-- Principle: tables are written only by admins (catalogue/settings) or by
-- security-definer functions (orders). Customers read through views.

-- ---------------------------------------------------------------------------
-- Schema / function privileges
-- ---------------------------------------------------------------------------
grant usage on schema private to anon, authenticated, service_role;
revoke all on all functions in schema private from public;
grant execute on function private.my_role() to authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_active_rider() to authenticated;
grant execute on function private.owns_order(uuid) to authenticated;

-- Supabase grants table privileges to anon/authenticated by default and relies on RLS.
-- Views bypass RLS, so lock them to SELECT only.
revoke all on public.public_settings, public.shops, public.menu_foods, public.my_orders, public.my_order_items
  from anon, authenticated;
grant select on public.public_settings, public.shops, public.menu_foods to anon, authenticated;
grant select on public.my_orders, public.my_order_items to authenticated;

-- Sequences: only server-side functions use them.
revoke all on sequence public.order_number_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.riders enable row level security;
alter table public.push_tokens enable row level security;
alter table public.businesses enable row level security;
alter table public.foods enable row level security;
alter table public.places enable row level security;
alter table public.customer_locations enable row level security;
alter table public.settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_codes enable row level security;
alter table public.order_events enable row level security;
alter table public.sms_messages enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: read own, admins read all. Writes go through functions / service role
-- (role and is_blocked must never be client-editable).
-- ---------------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_admin on public.profiles
  for select to authenticated using ((select private.is_admin()));
revoke insert, update, delete on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- riders: a rider reads own row; admins manage
-- ---------------------------------------------------------------------------
create policy riders_select_own on public.riders
  for select to authenticated using (profile_id = (select auth.uid()));
create policy riders_admin_all on public.riders
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- push_tokens: own rows only
-- ---------------------------------------------------------------------------
create policy push_tokens_own on public.push_tokens
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Catalogue: admins only on the tables; the public reads the `shops` and `menu_foods` views.
-- ---------------------------------------------------------------------------
create policy businesses_admin_all on public.businesses
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy foods_admin_all on public.foods
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- places are public
create policy places_select_all on public.places
  for select to anon, authenticated using (true);
create policy places_admin_write on public.places
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- customer_locations: own rows; admins read
-- ---------------------------------------------------------------------------
create policy customer_locations_own on public.customer_locations
  for all to authenticated
  using (customer_id = (select auth.uid()))
  with check (customer_id = (select auth.uid()));
create policy customer_locations_admin_select on public.customer_locations
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- settings: admins only on the table; everyone else reads `public_settings`
-- ---------------------------------------------------------------------------
create policy settings_admin_select on public.settings
  for select to authenticated using ((select private.is_admin()));
create policy settings_admin_update on public.settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
revoke insert, delete on public.settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- orders / order_items: admins and the assigned rider read. Customers use views.
-- No direct writes for anyone — only the order functions change orders.
-- ---------------------------------------------------------------------------
create policy orders_admin_select on public.orders
  for select to authenticated using ((select private.is_admin()));
create policy orders_rider_select on public.orders
  for select to authenticated using (rider_id = (select auth.uid()));
revoke insert, update, delete on public.orders from anon, authenticated;

create policy order_items_admin_select on public.order_items
  for select to authenticated using ((select private.is_admin()));
create policy order_items_rider_select on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.rider_id = (select auth.uid()))
  );
revoke insert, update, delete on public.order_items from anon, authenticated;

-- ---------------------------------------------------------------------------
-- order_codes: the order's customer and admins. NEVER riders.
-- ---------------------------------------------------------------------------
create policy order_codes_customer_select on public.order_codes
  for select to authenticated using ((select private.owns_order(order_id)));
create policy order_codes_admin_select on public.order_codes
  for select to authenticated using ((select private.is_admin()));
revoke insert, update, delete on public.order_codes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- order_events, sms_messages: admins read only
-- ---------------------------------------------------------------------------
create policy order_events_admin_select on public.order_events
  for select to authenticated using ((select private.is_admin()));
revoke insert, update, delete on public.order_events from anon, authenticated;

create policy sms_messages_admin_select on public.sms_messages
  for select to authenticated using ((select private.is_admin()));
revoke insert, update, delete on public.sms_messages from anon, authenticated;

-- anon gets nothing on private tables at all (defence in depth on top of RLS)
revoke all on public.profiles, public.riders, public.push_tokens, public.customer_locations,
  public.settings, public.orders, public.order_items, public.order_codes, public.order_events,
  public.sms_messages, public.businesses, public.foods
  from anon;
