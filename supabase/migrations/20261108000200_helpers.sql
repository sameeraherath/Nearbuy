-- Helper functions, auth trigger, and read-only views.

-- ---------------------------------------------------------------------------
-- Role / identity helpers (private schema: usable from RLS, not exposed as RPC)
-- ---------------------------------------------------------------------------
create or replace function private.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false);
$$;

create or replace function private.is_active_rider()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.riders r
    join public.profiles p on p.id = r.profile_id
    where r.profile_id = (select auth.uid()) and r.is_active and p.role = 'rider' and not p.is_blocked
  );
$$;

-- True if the signed-in user is the customer of this order. Security definer so
-- policies on other tables can use it even though customers can't read `orders`.
create or replace function private.owns_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.orders where id = p_order_id and customer_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- Time helpers (Asia/Colombo)
-- ---------------------------------------------------------------------------
create or replace function private.colombo_now()
returns timestamp
language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Colombo'); $$;

create or replace function private.colombo_today()
returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Colombo')::date; $$;

create or replace function private.is_ordering_open()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select s.ordering_enabled and (now() at time zone 'Asia/Colombo')::time < s.cutoff_time
  from public.settings s where s.id;
$$;

-- Rule 4: delivery fee for an items total on a given Colombo date.
create or replace function private.delivery_fee_for(p_items_total integer, p_today date)
returns integer
language sql stable security definer set search_path = ''
as $$
  select case
    when s.free_delivery_over is not null
     and p_items_total >= s.free_delivery_over
     and (s.free_delivery_until is null or p_today <= s.free_delivery_until)
    then 0
    else s.delivery_fee
  end
  from public.settings s where s.id;
$$;

-- "Rs 2,100"
create or replace function private.format_rs(p_amount integer)
returns text
language sql immutable set search_path = ''
as $$ select 'Rs ' || trim(to_char(p_amount, 'FM999,999,999,990')); $$;

-- Normalise auth.users.phone ("94771234567") to E.164.
create or replace function private.normalize_phone(p_phone text)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_phone is null or p_phone = '' then null
    when left(p_phone, 1) = '+' then p_phone
    else '+' || p_phone
  end;
$$;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create or replace function private.log_event(p_order_id uuid, p_type text, p_data jsonb default '{}')
returns void
language sql security definer set search_path = ''
as $$
  insert into public.order_events (order_id, type, actor_id, data)
  values (p_order_id, p_type, (select auth.uid()), coalesce(p_data, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- Profiles: created automatically for every auth user.
-- The role comes from raw_app_meta_data (only the service role can set it);
-- user-editable metadata is never trusted for roles.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.user_role := 'customer';
begin
  if coalesce(private.normalize_phone(new.phone), '') !~ '^\+947[0-9]{8}$' then
    raise exception 'Only Sri Lankan mobile numbers (+94 7X XXX XXXX) are supported'
      using errcode = '22023';
  end if;
  if new.raw_app_meta_data ? 'role' and new.raw_app_meta_data ->> 'role' in ('customer', 'rider', 'admin') then
    v_role := (new.raw_app_meta_data ->> 'role')::public.user_role;
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    v_role,
    left(coalesce(new.raw_app_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'full_name', ''), 60),
    private.normalize_phone(new.phone)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Settings: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

create trigger settings_touch before update on public.settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Read-only views for anonymous / customer access.
-- They run with the owner's rights (bypassing table RLS) so every view filters
-- explicitly, and they never expose shop prices, rider pay or codes.
-- ---------------------------------------------------------------------------

-- Public ordering state. Includes the server's clock so apps don't trust the device clock.
create view public.public_settings with (security_barrier) as
select
  s.cutoff_time,
  s.delivery_window_text,
  s.ordering_enabled,
  s.delivery_fee,
  s.free_delivery_over,
  s.free_delivery_until,
  s.min_order_amount,
  s.help_phone,
  (s.ordering_enabled and (now() at time zone 'Asia/Colombo')::time < s.cutoff_time) as is_open,
  (now() at time zone 'Asia/Colombo')::date as today,
  now() as server_now
from public.settings s
where s.id;

-- Active shops (no phone number — students don't call shops).
create view public.shops with (security_barrier) as
select b.id, b.name, b.area, b.cuisine_tags, b.cover_photo_path, b.sort_order
from public.businesses b
where b.is_active;

-- Menu items of active shops, without shop prices.
create view public.menu_foods with (security_barrier) as
select f.id, f.business_id, f.name, f.description, f.category, f.photo_path,
       f.selling_price, f.is_available, f.sort_order
from public.foods f
join public.businesses b on b.id = f.business_id
where b.is_active;

-- The signed-in customer's orders, without shop totals or rider pay.
create view public.my_orders with (security_barrier) as
select o.id, o.order_number, o.business_id, b.name as business_name, o.delivery_date, o.status,
       o.location_label, o.location_room, o.location_note, o.location_lat, o.location_lng,
       o.items_selling_total, o.delivery_fee, o.total_to_collect,
       o.placed_at, o.cancelled_at, o.assigned_at, o.picked_up_at, o.delivered_at
from public.orders o
join public.businesses b on b.id = o.business_id
where o.customer_id = (select auth.uid());

create view public.my_order_items with (security_barrier) as
select i.id, i.order_id, i.food_id, i.name, i.qty, i.selling_price, i.is_unavailable
from public.order_items i
join public.orders o on o.id = i.order_id
where o.customer_id = (select auth.uid());
