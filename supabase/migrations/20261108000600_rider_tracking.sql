-- Live rider tracking: riders share their position while on a run; a customer sees
-- the rider only once their own order has been picked up.

create table public.rider_locations (
  rider_id uuid primary key references public.riders (profile_id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  heading double precision,
  speed double precision,
  accuracy double precision,
  updated_at timestamptz not null default now()
);
comment on table public.rider_locations is 'Last known rider position. Written only by rider_update_location().';

alter table public.rider_locations enable row level security;
create policy rider_locations_admin_select on public.rider_locations
  for select to authenticated using ((select private.is_admin()));
create policy rider_locations_own_select on public.rider_locations
  for select to authenticated using (rider_id = (select auth.uid()));
revoke insert, update, delete on public.rider_locations from anon, authenticated;
revoke all on public.rider_locations from anon;

-- ---------------------------------------------------------------------------
-- rider_update_location (rider): store the position and push it to the
-- customers whose orders this rider is carrying right now.
-- ---------------------------------------------------------------------------
create or replace function public.rider_update_location(
  p_lat double precision,
  p_lng double precision,
  p_heading double precision default null,
  p_speed double precision default null,
  p_accuracy double precision default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_order record;
begin
  if not private.is_active_rider() then
    raise exception 'NB_FORBIDDEN';
  end if;
  if p_lat is null or p_lng is null or p_lat not between 5.8 and 10.0 or p_lng not between 79.4 and 82.0 then
    raise exception 'NB_LOCATION_REQUIRED';
  end if;

  insert into public.rider_locations (rider_id, lat, lng, heading, speed, accuracy, updated_at)
  values (v_uid, p_lat, p_lng, p_heading, p_speed, p_accuracy, v_now)
  on conflict (rider_id) do update
    set lat = excluded.lat, lng = excluded.lng, heading = excluded.heading,
        speed = excluded.speed, accuracy = excluded.accuracy, updated_at = excluded.updated_at;

  for v_order in
    select id from public.orders
     where rider_id = v_uid and status = 'picked_up' and delivery_date = private.colombo_today()
  loop
    perform realtime.send(
      jsonb_build_object('lat', p_lat, 'lng', p_lng, 'heading', p_heading, 'updated_at', v_now),
      'rider_location', 'order:' || v_order.id::text, true);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- order_rider_location (customer): the rider's last position for the customer's
-- own order, only while it is on the way and the fix is recent.
-- ---------------------------------------------------------------------------
create or replace function public.order_rider_location(p_order_id uuid)
returns table (lat double precision, lng double precision, heading double precision, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select l.lat, l.lng, l.heading, l.updated_at
  from public.orders o
  join public.rider_locations l on l.rider_id = o.rider_id
  where o.id = p_order_id
    and o.customer_id = (select auth.uid())
    and o.status = 'picked_up'
    and l.updated_at > now() - interval '15 minutes';
$$;

revoke all on function public.rider_update_location(double precision, double precision, double precision, double precision, double precision) from public, anon;
revoke all on function public.order_rider_location(uuid) from public, anon;
grant execute on function public.rider_update_location(double precision, double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.order_rider_location(uuid) to authenticated;
