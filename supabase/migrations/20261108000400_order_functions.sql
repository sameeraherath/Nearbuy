-- Order lifecycle functions. These are the ONLY way orders change.
-- Errors are raised as 'NB_<CODE>' or 'NB_<CODE>:<detail>' and mapped to user text in
-- @nearbuy/shared (serverErrorMessage).

-- ---------------------------------------------------------------------------
-- SMS outbox helper (the sms-dispatch Edge Function delivers queued rows)
-- ---------------------------------------------------------------------------
create or replace function private.enqueue_sms(
  p_kind public.sms_kind, p_to text, p_body text, p_order_id uuid default null, p_profile_id uuid default null
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.sms_messages (kind, to_phone, body, order_id, profile_id)
  values (p_kind, p_to, p_body, p_order_id, p_profile_id);
$$;

-- Cryptographically random 4-digit code, unique among the day's open orders.
-- Caller must hold the per-day advisory lock.
create or replace function private.new_delivery_code(p_day date)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text;
  v_tries integer := 0;
begin
  loop
    v_code := lpad(
      ((('x' || lpad(encode(extensions.gen_random_bytes(4), 'hex'), 16, '0'))::bit(64)::bigint) % 10000)::text,
      4, '0');
    exit when not exists (
      select 1
      from public.order_codes c
      join public.orders o on o.id = c.order_id
      where c.code = v_code
        and o.delivery_date = p_day
        and o.status in ('placed', 'assigned', 'picked_up')
    );
    v_tries := v_tries + 1;
    if v_tries > 200 then
      raise exception 'NB_CODE_SPACE_EXHAUSTED';
    end if;
  end loop;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- place_order (customer)
--   p_items:    [{"food_id": uuid, "qty": int}, ...]
--   p_location: {"place_id": uuid?, "label": text, "room": text?, "note": text?, "lat": num?, "lng": num?}
-- Client prices are ignored; everything is read from the database.
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_business_id uuid,
  p_items jsonb,
  p_location jsonb,
  p_customer_name text default null,
  p_save_location boolean default true,
  p_client_ref uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_settings public.settings;
  v_today date := private.colombo_today();
  v_elem jsonb;
  v_food_id uuid;
  v_qty numeric;
  v_ids uuid[] := '{}';
  v_qtys integer[] := '{}';
  v_line_count integer;
  v_valid_count integer;
  v_selling integer;
  v_shop integer;
  v_fee integer;
  v_name text;
  v_place public.places;
  v_place_id uuid;
  v_label text;
  v_room text;
  v_note text;
  v_lat double precision;
  v_lng double precision;
  v_order public.orders;
  v_code text;
begin
  if v_uid is null then
    raise exception 'NB_NOT_AUTHENTICATED';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'NB_NOT_AUTHENTICATED';
  end if;
  if v_profile.is_blocked then
    raise exception 'NB_BLOCKED';
  end if;
  if v_profile.role <> 'customer' then
    raise exception 'NB_FORBIDDEN';
  end if;

  -- Idempotent retry: same client_ref → same order.
  if p_client_ref is not null then
    select * into v_order from public.orders where customer_id = v_uid and client_ref = p_client_ref;
    if found then
      return jsonb_build_object(
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'code', (select code from public.order_codes where order_id = v_order.id),
        'items_selling_total', v_order.items_selling_total,
        'delivery_fee', v_order.delivery_fee,
        'total_to_collect', v_order.total_to_collect,
        'replayed', true
      );
    end if;
  end if;

  select * into v_settings from public.settings where id;
  if not private.is_ordering_open() then
    raise exception 'NB_ORDERING_CLOSED';
  end if;

  perform 1 from public.businesses where id = p_business_id and is_active;
  if not found then
    raise exception 'NB_BUSINESS_UNAVAILABLE';
  end if;

  -- Parse and validate lines
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'NB_EMPTY_CART';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'NB_BAD_QTY';
  end if;

  for v_elem in select value from jsonb_array_elements(p_items) loop
    begin
      v_food_id := (v_elem ->> 'food_id')::uuid;
      v_qty := (v_elem ->> 'qty')::numeric;
    exception when others then
      raise exception 'NB_BAD_QTY';
    end;
    if v_food_id is null or v_qty is null or v_qty <> trunc(v_qty) or v_qty < 1 or v_qty > 20 then
      raise exception 'NB_BAD_QTY';
    end if;
    v_ids := v_ids || v_food_id;
    v_qtys := v_qtys || v_qty::integer;
  end loop;

  -- Merge duplicate food ids
  select array_agg(food_id order by food_id), array_agg(qty order by food_id)
    into v_ids, v_qtys
  from (
    select t.food_id, sum(t.qty)::integer as qty
    from unnest(v_ids, v_qtys) as t(food_id, qty)
    group by t.food_id
  ) merged;

  if exists (select 1 from unnest(v_qtys) q where q > 20) then
    raise exception 'NB_BAD_QTY';
  end if;

  v_line_count := cardinality(v_ids);
  select count(*), coalesce(sum(f.selling_price * l.qty), 0), coalesce(sum(f.shop_price * l.qty), 0)
    into v_valid_count, v_selling, v_shop
  from unnest(v_ids, v_qtys) as l(food_id, qty)
  join public.foods f on f.id = l.food_id
  where f.business_id = p_business_id and f.is_available;

  if v_valid_count <> v_line_count then
    raise exception 'NB_FOOD_UNAVAILABLE';
  end if;

  if v_selling < v_settings.min_order_amount then
    raise exception 'NB_MIN_ORDER:%', v_settings.min_order_amount;
  end if;

  v_fee := private.delivery_fee_for(v_selling, v_today);

  -- Customer name (riders need it at hand-over)
  v_name := left(coalesce(nullif(trim(p_customer_name), ''), v_profile.full_name), 60);
  if v_name = '' then
    raise exception 'NB_NAME_REQUIRED';
  end if;
  if v_name is distinct from v_profile.full_name then
    update public.profiles set full_name = v_name where id = v_uid;
  end if;

  -- Location
  if p_location is null or jsonb_typeof(p_location) <> 'object' then
    raise exception 'NB_LOCATION_REQUIRED';
  end if;
  begin
    v_place_id := nullif(p_location ->> 'place_id', '')::uuid;
    v_lat := (p_location ->> 'lat')::double precision;
    v_lng := (p_location ->> 'lng')::double precision;
  exception when others then
    raise exception 'NB_LOCATION_REQUIRED';
  end;
  v_label := left(nullif(trim(p_location ->> 'label'), ''), 80);
  v_room := left(coalesce(trim(p_location ->> 'room'), ''), 40);
  v_note := left(coalesce(trim(p_location ->> 'note'), ''), 200);

  if v_place_id is not null then
    select * into v_place from public.places where id = v_place_id;
    if not found then
      raise exception 'NB_LOCATION_REQUIRED';
    end if;
    v_lat := coalesce(v_lat, v_place.lat);
    v_lng := coalesce(v_lng, v_place.lng);
    v_label := coalesce(v_label, v_place.name);
  end if;

  -- Must be a real point in Sri Lanka
  if v_label is null or v_lat is null or v_lng is null
     or v_lat not between 5.8 and 10.0 or v_lng not between 79.4 and 82.0 then
    raise exception 'NB_LOCATION_REQUIRED';
  end if;

  -- Serialise code generation per delivery day
  perform pg_advisory_xact_lock(hashtextextended('nearbuy:order_code:' || v_today::text, 0));
  v_code := private.new_delivery_code(v_today);

  insert into public.orders (
    customer_id, business_id, delivery_date, status,
    location_place_id, location_label, location_room, location_note, location_lat, location_lng,
    customer_name, customer_phone,
    items_selling_total, items_shop_total, delivery_fee, total_to_collect, client_ref
  ) values (
    v_uid, p_business_id, v_today, 'placed',
    v_place_id, v_label, v_room, v_note, v_lat, v_lng,
    v_name, v_profile.phone,
    v_selling, v_shop, v_fee, v_selling + v_fee, p_client_ref
  )
  returning * into v_order;

  insert into public.order_items (order_id, food_id, name, qty, selling_price, shop_price)
  select v_order.id, f.id, f.name, l.qty, f.selling_price, f.shop_price
  from unnest(v_ids, v_qtys) as l(food_id, qty)
  join public.foods f on f.id = l.food_id;

  insert into public.order_codes (order_id, code) values (v_order.id, v_code);

  perform private.log_event(v_order.id, 'placed', jsonb_build_object(
    'items_selling_total', v_selling,
    'items_shop_total', v_shop,
    'delivery_fee', v_fee,
    'total_to_collect', v_selling + v_fee,
    'lines', v_line_count
  ));

  perform private.enqueue_sms(
    'order_placed',
    v_profile.phone,
    format('Nearbuy: Order %s confirmed. Your delivery code is %s. Pay %s cash. Delivery %s.',
      v_order.order_number, v_code, private.format_rs(v_selling + v_fee), v_settings.delivery_window_text),
    v_order.id, v_uid
  );

  -- Remember the location as the customer's default
  if coalesce(p_save_location, true) then
    update public.customer_locations
       set place_id = v_place_id, label = v_label, room = v_room, note = v_note, lat = v_lat, lng = v_lng
     where customer_id = v_uid and is_default;
    if not found then
      insert into public.customer_locations (customer_id, place_id, label, room, note, lat, lng, is_default)
      values (v_uid, v_place_id, v_label, v_room, v_note, v_lat, v_lng, true);
    end if;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'code', v_code,
    'items_selling_total', v_selling,
    'delivery_fee', v_fee,
    'total_to_collect', v_selling + v_fee,
    'replayed', false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_order (customer): own order, status = placed, before today's cutoff
-- ---------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if (select auth.uid()) is null then
    raise exception 'NB_NOT_AUTHENTICATED';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and customer_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'NB_ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'placed' then
    raise exception 'NB_BAD_STATUS';
  end if;
  if v_order.delivery_date <> private.colombo_today() or not private.is_ordering_open() then
    raise exception 'NB_ORDERING_CLOSED';
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now() where id = p_order_id;
  perform private.log_event(p_order_id, 'cancelled', jsonb_build_object('by', 'customer'));
end;
$$;

-- ---------------------------------------------------------------------------
-- assign_orders (admin): bulk assign to a rider; NULL rider = unassign.
-- Only orders that are placed or assigned can be (re)assigned.
-- ---------------------------------------------------------------------------
create or replace function public.assign_orders(p_order_ids uuid[], p_rider_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_found integer;
  v_order record;
begin
  if not private.is_admin() then
    raise exception 'NB_FORBIDDEN';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    return 0;
  end if;

  if p_rider_id is not null then
    perform 1
      from public.riders r join public.profiles p on p.id = r.profile_id
     where r.profile_id = p_rider_id and r.is_active and p.role = 'rider' and not p.is_blocked;
    if not found then
      raise exception 'NB_RIDER_NOT_FOUND';
    end if;
  end if;

  -- Lock all target orders in a stable order to avoid deadlocks
  perform 1 from public.orders where id = any (p_order_ids) order by id for update;

  select count(*) into v_found from public.orders where id = any (p_order_ids);
  if v_found <> cardinality(array(select distinct unnest(p_order_ids))) then
    raise exception 'NB_ORDER_NOT_FOUND';
  end if;
  if exists (select 1 from public.orders where id = any (p_order_ids) and status not in ('placed', 'assigned')) then
    raise exception 'NB_BAD_STATUS';
  end if;

  for v_order in
    select id, rider_id from public.orders where id = any (p_order_ids) order by id
  loop
    continue when v_order.rider_id is not distinct from p_rider_id;

    if p_rider_id is null then
      update public.orders set status = 'placed', rider_id = null, assigned_at = null where id = v_order.id;
      perform private.log_event(v_order.id, 'unassigned', jsonb_build_object('previous_rider_id', v_order.rider_id));
    else
      update public.orders set status = 'assigned', rider_id = p_rider_id, assigned_at = now() where id = v_order.id;
      perform private.log_event(v_order.id, 'assigned', jsonb_build_object(
        'rider_id', p_rider_id, 'previous_rider_id', v_order.rider_id));
    end if;
  end loop;

  return v_found;
end;
$$;

-- ---------------------------------------------------------------------------
-- rider_set_item_unavailable (rider): before pickup. Recalculates totals and
-- texts the customer. If nothing is left, the order is cancelled.
-- The delivery fee stays as charged at placement.
-- ---------------------------------------------------------------------------
create or replace function public.rider_set_item_unavailable(p_order_item_id uuid, p_unavailable boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_item public.order_items;
  v_order public.orders;
  v_selling integer;
  v_shop integer;
  v_remaining integer;
begin
  if not private.is_active_rider() then
    raise exception 'NB_FORBIDDEN';
  end if;

  select o.* into v_order
    from public.orders o join public.order_items i on i.order_id = o.id
   where i.id = p_order_item_id and o.rider_id = (select auth.uid())
   for update of o;
  if not found then
    raise exception 'NB_ORDER_NOT_FOUND';
  end if;
  if v_order.status <> 'assigned' then
    raise exception 'NB_BAD_STATUS';
  end if;

  select * into v_item from public.order_items where id = p_order_item_id for update;

  if v_item.is_unavailable = p_unavailable then
    return jsonb_build_object('order_id', v_order.id, 'status', v_order.status,
      'items_selling_total', v_order.items_selling_total, 'total_to_collect', v_order.total_to_collect);
  end if;

  update public.order_items set is_unavailable = p_unavailable where id = p_order_item_id;

  select coalesce(sum(selling_price * qty), 0), coalesce(sum(shop_price * qty), 0), count(*)
    into v_selling, v_shop, v_remaining
  from public.order_items where order_id = v_order.id and not is_unavailable;

  if v_remaining = 0 then
    update public.orders
       set status = 'cancelled', cancelled_at = now(),
           items_selling_total = 0, items_shop_total = 0, total_to_collect = delivery_fee
     where id = v_order.id
     returning * into v_order;
    perform private.log_event(v_order.id, 'item_unavailable', jsonb_build_object(
      'order_item_id', v_item.id, 'name', v_item.name, 'qty', v_item.qty));
    perform private.log_event(v_order.id, 'cancelled', jsonb_build_object('by', 'system', 'reason', 'all_items_unavailable'));
    perform private.enqueue_sms('order_cancelled', v_order.customer_phone,
      format('Nearbuy: Sorry, the food in order %s is not available today, so the order is cancelled. You pay nothing.',
        v_order.order_number),
      v_order.id, v_order.customer_id);
  else
    update public.orders
       set items_selling_total = v_selling, items_shop_total = v_shop, total_to_collect = v_selling + delivery_fee
     where id = v_order.id
     returning * into v_order;
    perform private.log_event(v_order.id, case when p_unavailable then 'item_unavailable' else 'item_available' end,
      jsonb_build_object('order_item_id', v_item.id, 'name', v_item.name, 'qty', v_item.qty,
        'items_selling_total', v_selling, 'total_to_collect', v_order.total_to_collect));
    perform private.enqueue_sms('item_unavailable', v_order.customer_phone,
      case when p_unavailable then
        format('Nearbuy: Sorry, %s x %s is not available for order %s. New total: %s cash.',
          v_item.qty, v_item.name, v_order.order_number, private.format_rs(v_order.total_to_collect))
      else
        format('Nearbuy: Good news, %s x %s is available again for order %s. New total: %s cash.',
          v_item.qty, v_item.name, v_order.order_number, private.format_rs(v_order.total_to_collect))
      end,
      v_order.id, v_order.customer_id);
  end if;

  return jsonb_build_object('order_id', v_order.id, 'status', v_order.status,
    'items_selling_total', v_order.items_selling_total, 'total_to_collect', v_order.total_to_collect);
end;
$$;

-- ---------------------------------------------------------------------------
-- rider_mark_picked_up (rider): one order or a whole shop group.
-- Orders already picked up are skipped, so the call is safe to retry.
-- ---------------------------------------------------------------------------
create or replace function public.rider_mark_picked_up(p_order_ids uuid[])
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_count integer := 0;
begin
  if not private.is_active_rider() then
    raise exception 'NB_FORBIDDEN';
  end if;
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    return 0;
  end if;

  perform 1 from public.orders where id = any (p_order_ids) order by id for update;

  if exists (select 1 from unnest(p_order_ids) as t(id)
             where not exists (select 1 from public.orders o where o.id = t.id and o.rider_id = v_uid)) then
    raise exception 'NB_ORDER_NOT_FOUND';
  end if;
  if exists (select 1 from public.orders where id = any (p_order_ids) and status not in ('assigned', 'picked_up')) then
    raise exception 'NB_BAD_STATUS';
  end if;

  for v_order in
    update public.orders set status = 'picked_up', picked_up_at = now()
     where id = any (p_order_ids) and status = 'assigned'
    returning *
  loop
    v_count := v_count + 1;
    perform private.log_event(v_order.id, 'picked_up', jsonb_build_object('total_to_collect', v_order.total_to_collect));
    perform private.enqueue_sms('picked_up', v_order.customer_phone,
      format('Nearbuy: Order %s is on the way. Pay %s cash and share your delivery code with the rider.',
        v_order.order_number, private.format_rs(v_order.total_to_collect)),
      v_order.id, v_order.customer_id);
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_delivery (rider): checks the 4-digit code. Wrong codes are counted
-- (so this returns a result instead of raising, to keep the increment).
-- Returns {"result": "delivered" | "wrong_code" | "locked", "attempts_left": n}
-- ---------------------------------------------------------------------------
create or replace function public.confirm_delivery(p_order_id uuid, p_code text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_code text;
  v_attempts integer;
  v_max constant integer := 3;
begin
  if not private.is_active_rider() then
    raise exception 'NB_FORBIDDEN';
  end if;

  select * into v_order from public.orders
   where id = p_order_id and rider_id = (select auth.uid())
   for update;
  if not found then
    raise exception 'NB_ORDER_NOT_FOUND';
  end if;

  if v_order.status = 'delivered' then
    return jsonb_build_object('result', 'delivered', 'attempts_left', greatest(v_max - v_order.code_attempts, 0));
  end if;
  if v_order.status <> 'picked_up' then
    raise exception 'NB_BAD_STATUS';
  end if;
  if v_order.code_attempts >= v_max then
    return jsonb_build_object('result', 'locked', 'attempts_left', 0);
  end if;

  select code into v_code from public.order_codes where order_id = p_order_id;

  if v_code is not null and p_code is not null and trim(p_code) = v_code then
    update public.orders
       set status = 'delivered', delivered_at = now(),
           rider_pay = (select rider_pay_per_delivery from public.settings where id)
     where id = p_order_id
     returning * into v_order;
    perform private.log_event(p_order_id, 'delivered', jsonb_build_object(
      'method', 'code', 'total_collected', v_order.total_to_collect, 'rider_pay', v_order.rider_pay));
    perform private.enqueue_sms('delivered', v_order.customer_phone,
      format('Order %s delivered. Thank you!', v_order.order_number),
      v_order.id, v_order.customer_id);
    return jsonb_build_object('result', 'delivered', 'attempts_left', v_max - v_order.code_attempts);
  end if;

  update public.orders set code_attempts = code_attempts + 1 where id = p_order_id
  returning code_attempts into v_attempts;
  perform private.log_event(p_order_id, 'code_attempt_failed', jsonb_build_object('attempt', v_attempts));
  if v_attempts >= v_max then
    perform private.log_event(p_order_id, 'code_locked', '{}');
    return jsonb_build_object('result', 'locked', 'attempts_left', 0);
  end if;
  return jsonb_build_object('result', 'wrong_code', 'attempts_left', v_max - v_attempts);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_override_delivery (admin): mark delivered without a code, with a reason.
-- ---------------------------------------------------------------------------
create or replace function public.admin_override_delivery(
  p_order_id uuid, p_reason public.override_reason, p_note text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
  v_note text := nullif(trim(p_note), '');
begin
  if not private.is_admin() then
    raise exception 'NB_FORBIDDEN';
  end if;
  if p_reason is null or (p_reason = 'other' and v_note is null) then
    raise exception 'NB_REASON_REQUIRED';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NB_ORDER_NOT_FOUND';
  end if;
  if v_order.status not in ('assigned', 'picked_up') then
    raise exception 'NB_BAD_STATUS';
  end if;

  update public.orders
     set status = 'delivered', delivered_at = now(),
         delivered_by_override = true, override_reason = p_reason, override_note = left(v_note, 200),
         rider_pay = (select rider_pay_per_delivery from public.settings where id)
   where id = p_order_id
   returning * into v_order;

  perform private.log_event(p_order_id, 'delivered', jsonb_build_object(
    'method', 'override', 'reason', p_reason, 'note', v_note,
    'total_collected', v_order.total_to_collect, 'rider_pay', v_order.rider_pay));
  perform private.enqueue_sms('delivered', v_order.customer_phone,
    format('Order %s delivered. Thank you!', v_order.order_number),
    v_order.id, v_order.customer_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_cancel_order (admin): e.g. a shop is closed. Any open order.
-- ---------------------------------------------------------------------------
create or replace function public.admin_cancel_order(p_order_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not private.is_admin() then
    raise exception 'NB_FORBIDDEN';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'NB_ORDER_NOT_FOUND';
  end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'NB_BAD_STATUS';
  end if;

  update public.orders set status = 'cancelled', cancelled_at = now() where id = p_order_id;
  perform private.log_event(p_order_id, 'cancelled', jsonb_build_object(
    'by', 'admin', 'reason', nullif(trim(p_reason), ''), 'previous_status', v_order.status));
  perform private.enqueue_sms('order_cancelled', v_order.customer_phone,
    format('Nearbuy: Sorry, order %s has been cancelled. You pay nothing.', v_order.order_number),
    v_order.id, v_order.customer_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_set_customer_blocked (admin): block/unblock a customer by phone (E.164)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_customer_blocked(p_phone text, p_blocked boolean)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'NB_FORBIDDEN';
  end if;
  update public.profiles set is_blocked = p_blocked
   where phone = p_phone and role = 'customer'
   returning id into v_id;
  if v_id is null then
    raise exception 'NB_PROFILE_NOT_FOUND';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- is_registered_staff (anyone): lets the rider/admin apps say
-- "This number is not registered as a rider." before sending a login code.
-- ---------------------------------------------------------------------------
create or replace function public.is_registered_staff(p_phone text, p_role public.user_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_role
    when 'rider' then exists (
      select 1 from public.profiles p join public.riders r on r.profile_id = p.id
      where p.phone = p_phone and p.role = 'rider' and r.is_active and not p.is_blocked)
    when 'admin' then exists (
      select 1 from public.profiles p where p.phone = p_phone and p.role = 'admin' and not p.is_blocked)
    else false
  end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: no anonymous access except the staff check.
-- ---------------------------------------------------------------------------
revoke all on function public.place_order(uuid, jsonb, jsonb, text, boolean, uuid) from public, anon;
revoke all on function public.cancel_order(uuid) from public, anon;
revoke all on function public.assign_orders(uuid[], uuid) from public, anon;
revoke all on function public.rider_set_item_unavailable(uuid, boolean) from public, anon;
revoke all on function public.rider_mark_picked_up(uuid[]) from public, anon;
revoke all on function public.confirm_delivery(uuid, text) from public, anon;
revoke all on function public.admin_override_delivery(uuid, public.override_reason, text) from public, anon;
revoke all on function public.admin_cancel_order(uuid, text) from public, anon;
revoke all on function public.admin_set_customer_blocked(text, boolean) from public, anon;
revoke all on function public.is_registered_staff(text, public.user_role) from public;

grant execute on function public.place_order(uuid, jsonb, jsonb, text, boolean, uuid) to authenticated;
grant execute on function public.cancel_order(uuid) to authenticated;
grant execute on function public.assign_orders(uuid[], uuid) to authenticated;
grant execute on function public.rider_set_item_unavailable(uuid, boolean) to authenticated;
grant execute on function public.rider_mark_picked_up(uuid[]) to authenticated;
grant execute on function public.confirm_delivery(uuid, text) to authenticated;
grant execute on function public.admin_override_delivery(uuid, public.override_reason, text) to authenticated;
grant execute on function public.admin_cancel_order(uuid, text) to authenticated;
grant execute on function public.admin_set_customer_blocked(text, boolean) to authenticated;
grant execute on function public.is_registered_staff(text, public.user_role) to anon, authenticated;

-- Private helpers are only called from the security-definer functions above.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.my_role() to authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.is_active_rider() to authenticated;
grant execute on function private.owns_order(uuid) to authenticated;
