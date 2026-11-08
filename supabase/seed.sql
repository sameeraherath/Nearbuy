-- Nearbuy development seed data. Runs after migrations on `supabase db reset`.
-- Local login codes for these numbers are fixed in config.toml ([auth.sms.test_otp]) → 123456.
--
--   Admin     +94764952122  amsh
--   Rider     +94770000011  Kasun Bandara
--   Rider     +94770000012  Tharindu Silva
--   Customer  +94771111111  Ishara Fernando
--   Customer  +94772222222  Dilini Jayasinghe
--   Customer  +94773333333  Ravindu Wickramasinghe

-- ---------------------------------------------------------------------------
-- Auth users (the on_auth_user_created trigger creates profiles from app metadata)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, phone_change, phone_change_token,
  email_change_token_current, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.phone, now(),
  jsonb_build_object('provider', 'phone', 'providers', array['phone'], 'role', u.role, 'full_name', u.full_name),
  '{}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, '94764952122', 'admin',    'amsh'),
  ('b0000000-0000-4000-8000-000000000011'::uuid, '94770000011', 'rider',    'Kasun Bandara'),
  ('b0000000-0000-4000-8000-000000000012'::uuid, '94770000012', 'rider',    'Tharindu Silva'),
  ('c0000000-0000-4000-8000-000000000001'::uuid, '94771111111', 'customer', 'Ishara Fernando'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, '94772222222', 'customer', 'Dilini Jayasinghe'),
  ('c0000000-0000-4000-8000-000000000003'::uuid, '94773333333', 'customer', 'Ravindu Wickramasinghe')
) as u(id, phone, role, full_name);

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'phone',
       jsonb_build_object('sub', u.id::text, 'phone', u.phone, 'phone_verified', true),
       now(), now(), now()
from auth.users u
where u.id in (
  'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000011',
  'b0000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001',
  'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003'
);

insert into public.riders (profile_id, vehicle_note) values
  ('b0000000-0000-4000-8000-000000000011', 'Bike · CAB-4521'),
  ('b0000000-0000-4000-8000-000000000012', 'Scooter · BEX-7783');

update public.settings set help_phone = '+94764952122';

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------
insert into public.businesses (id, name, area, phone, cuisine_tags, sort_order) values
  ('d0000000-0000-4000-8000-000000000001', 'Kottu Corner', 'Pambahinna Junction', '+94712345001', '{Kottu,Sri Lankan}', 1),
  ('d0000000-0000-4000-8000-000000000002', 'Samanala Rice & Curry', 'Pambahinna Junction', '+94712345002', '{Rice & Curry,Sri Lankan}', 2),
  ('d0000000-0000-4000-8000-000000000003', 'Belihuloya Bakehouse', 'Belihuloya Town', '+94712345003', '{Bakery,Short eats}', 3),
  ('d0000000-0000-4000-8000-000000000004', 'Uni Gate Café', 'University Main Gate', '+94712345004', '{Café,Drinks}', 4);

-- ---------------------------------------------------------------------------
-- Foods (shop price / selling price, LKR)
-- ---------------------------------------------------------------------------
insert into public.foods (id, business_id, name, description, category, shop_price, selling_price, is_available, sort_order) values
  -- Kottu Corner
  ('f0000000-0000-4000-8000-000000000101', 'd0000000-0000-4000-8000-000000000001', 'Chicken Kottu', 'Chopped roti with chicken, egg and vegetables', 'Kottu', 800, 850, true, 1),
  ('f0000000-0000-4000-8000-000000000102', 'd0000000-0000-4000-8000-000000000001', 'Egg Kottu', 'Chopped roti with egg and vegetables', 'Kottu', 600, 650, true, 2),
  ('f0000000-0000-4000-8000-000000000103', 'd0000000-0000-4000-8000-000000000001', 'Cheese Kottu', 'Chicken kottu with melted cheese', 'Kottu', 1050, 1100, true, 3),
  ('f0000000-0000-4000-8000-000000000104', 'd0000000-0000-4000-8000-000000000001', 'Vegetable Kottu', 'Chopped roti with mixed vegetables', 'Kottu', 500, 550, true, 4),
  ('f0000000-0000-4000-8000-000000000105', 'd0000000-0000-4000-8000-000000000001', 'Iced Milo', 'Chilled Milo', 'Drinks', 200, 220, false, 10),
  -- Samanala Rice & Curry
  ('f0000000-0000-4000-8000-000000000201', 'd0000000-0000-4000-8000-000000000002', 'Rice & Curry (Chicken)', 'Red rice, chicken curry, dhal, two vegetables, papadam', 'Rice', 370, 400, true, 1),
  ('f0000000-0000-4000-8000-000000000202', 'd0000000-0000-4000-8000-000000000002', 'Rice & Curry (Fish)', 'Red rice, fish curry, dhal, two vegetables, papadam', 'Rice', 350, 380, true, 2),
  ('f0000000-0000-4000-8000-000000000203', 'd0000000-0000-4000-8000-000000000002', 'Rice & Curry (Vegetable)', 'Red rice, dhal, three vegetables, papadam', 'Rice', 250, 280, true, 3),
  ('f0000000-0000-4000-8000-000000000204', 'd0000000-0000-4000-8000-000000000002', 'Egg Fried Rice', 'Fried rice with egg and chilli paste', 'Rice', 550, 600, true, 4),
  -- Belihuloya Bakehouse
  ('f0000000-0000-4000-8000-000000000301', 'd0000000-0000-4000-8000-000000000003', 'Fish Bun', 'Soft bun with spicy fish filling', 'Short eats', 100, 120, true, 1),
  ('f0000000-0000-4000-8000-000000000302', 'd0000000-0000-4000-8000-000000000003', 'Chicken Roll', 'Crumbed roll with chicken and potato', 'Short eats', 120, 140, true, 2),
  ('f0000000-0000-4000-8000-000000000303', 'd0000000-0000-4000-8000-000000000003', 'Egg Bun', 'Bun with a boiled egg and seeni sambol', 'Short eats', 110, 130, true, 3),
  ('f0000000-0000-4000-8000-000000000304', 'd0000000-0000-4000-8000-000000000003', 'Butter Cake (slice)', 'Fresh butter cake', 'Sweets', 80, 100, true, 4),
  ('f0000000-0000-4000-8000-000000000305', 'd0000000-0000-4000-8000-000000000003', 'Tea', 'Plain tea with sugar', 'Drinks', 50, 60, true, 5),
  -- Uni Gate Café
  ('f0000000-0000-4000-8000-000000000401', 'd0000000-0000-4000-8000-000000000004', 'Iced Coffee', 'Sweet iced coffee', 'Drinks', 230, 250, true, 1),
  ('f0000000-0000-4000-8000-000000000402', 'd0000000-0000-4000-8000-000000000004', 'Milk Tea', 'Hot milk tea', 'Drinks', 80, 100, true, 2),
  ('f0000000-0000-4000-8000-000000000403', 'd0000000-0000-4000-8000-000000000004', 'Chicken Submarine', 'Toasted sub with chicken and vegetables', 'Sandwiches', 450, 500, true, 3),
  ('f0000000-0000-4000-8000-000000000404', 'd0000000-0000-4000-8000-000000000004', 'Cheese Toast', 'Toasted bread with cheese', 'Sandwiches', 250, 280, true, 4);

-- ---------------------------------------------------------------------------
-- Places — PLACEHOLDER coordinates near Sabaragamuwa University, Belihuloya.
-- Replace with surveyed points before launch.
-- ---------------------------------------------------------------------------
insert into public.places (id, name, lat, lng, sort_order) values
  ('e0000000-0000-4000-8000-000000000001', 'Hostel Block A', 6.71480, 80.78710, 1),
  ('e0000000-0000-4000-8000-000000000002', 'Hostel Block B', 6.71520, 80.78790, 2),
  ('e0000000-0000-4000-8000-000000000003', 'Hostel Block C', 6.71560, 80.78860, 3),
  ('e0000000-0000-4000-8000-000000000004', 'Hostel Block D', 6.71610, 80.78930, 4),
  ('e0000000-0000-4000-8000-000000000005', 'Faculty of Applied Sciences (main entrance)', 6.71380, 80.78560, 5),
  ('e0000000-0000-4000-8000-000000000006', 'Main Gate', 6.71250, 80.78420, 6),
  ('e0000000-0000-4000-8000-000000000007', 'Pambahinna Road boarding area', 6.71100, 80.78200, 7);

-- ---------------------------------------------------------------------------
-- Saved customer locations
-- ---------------------------------------------------------------------------
insert into public.customer_locations (customer_id, place_id, label, room, note, lat, lng, is_default) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'Hostel Block C', 'Room 214', 'Call when you reach the gate', 6.71560, 80.78860, true),
  ('c0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000001', 'Hostel Block A', 'Room 108', '', 6.71480, 80.78710, true),
  ('c0000000-0000-4000-8000-000000000003', null, 'Boarding house near Pambahinna temple', 'Upstairs', 'Blue gate', 6.71050, 80.78150, true);

-- ---------------------------------------------------------------------------
-- Today's orders in different states. Totals are computed from the items.
-- Delivery codes: NB-2001 → 4829, NB-2002 → 1375, NB-2003 → 9041, NB-2004 → 5562, NB-2005 → 7310
-- ---------------------------------------------------------------------------
do $$
declare
  v_today date := (now() at time zone 'Asia/Colombo')::date;
  v_kasun uuid := 'b0000000-0000-4000-8000-000000000011';
  v_admin uuid := 'a0000000-0000-4000-8000-000000000001';
  r record;
  v_order_id uuid;
  v_selling integer;
  v_shop integer;
begin
  for r in
    select * from (values
      -- n, customer, business, status, code, items (food_id:qty), location
      (1, 'c0000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'placed',    '4829',
         '{"f0000000-0000-4000-8000-000000000101":2,"f0000000-0000-4000-8000-000000000102":1}'::jsonb, 'Hostel Block C', 'Room 214'),
      (2, 'c0000000-0000-4000-8000-000000000002'::uuid, 'd0000000-0000-4000-8000-000000000001'::uuid, 'assigned',  '1375',
         '{"f0000000-0000-4000-8000-000000000103":1}'::jsonb, 'Hostel Block A', 'Room 108'),
      (3, 'c0000000-0000-4000-8000-000000000003'::uuid, 'd0000000-0000-4000-8000-000000000002'::uuid, 'picked_up', '9041',
         '{"f0000000-0000-4000-8000-000000000201":2}'::jsonb, 'Boarding house near Pambahinna temple', 'Upstairs'),
      (4, 'c0000000-0000-4000-8000-000000000001'::uuid, 'd0000000-0000-4000-8000-000000000003'::uuid, 'delivered', '5562',
         '{"f0000000-0000-4000-8000-000000000301":3,"f0000000-0000-4000-8000-000000000305":2}'::jsonb, 'Hostel Block C', 'Room 214'),
      (5, 'c0000000-0000-4000-8000-000000000002'::uuid, 'd0000000-0000-4000-8000-000000000004'::uuid, 'cancelled', '7310',
         '{"f0000000-0000-4000-8000-000000000401":2}'::jsonb, 'Hostel Block A', 'Room 108')
    ) as t(n, customer_id, business_id, status, code, items, label, room)
    order by n
  loop
    select coalesce(sum(f.selling_price * (i.value)::int), 0), coalesce(sum(f.shop_price * (i.value)::int), 0)
      into v_selling, v_shop
    from jsonb_each_text(r.items) i join public.foods f on f.id = i.key::uuid;

    insert into public.orders (
      customer_id, business_id, delivery_date, status,
      location_place_id, location_label, location_room, location_note, location_lat, location_lng,
      customer_name, customer_phone,
      items_selling_total, items_shop_total, delivery_fee, total_to_collect,
      rider_id, rider_pay, placed_at, assigned_at, picked_up_at, delivered_at, cancelled_at
    )
    select r.customer_id, r.business_id, v_today, r.status::public.order_status,
           cl.place_id, cl.label, cl.room, cl.note, cl.lat, cl.lng,
           p.full_name, p.phone,
           v_selling, v_shop, 100, v_selling + 100,
           case when r.status in ('assigned', 'picked_up', 'delivered') then v_kasun end,
           case when r.status = 'delivered' then 60 else 0 end,
           now() - interval '3 hours',
           case when r.status in ('assigned', 'picked_up', 'delivered') then now() - interval '1 hour' end,
           case when r.status in ('picked_up', 'delivered') then now() - interval '30 minutes' end,
           case when r.status = 'delivered' then now() - interval '10 minutes' end,
           case when r.status = 'cancelled' then now() - interval '2 hours' end
    from public.profiles p
    join public.customer_locations cl on cl.customer_id = p.id and cl.is_default
    where p.id = r.customer_id
    returning id into v_order_id;

    insert into public.order_items (order_id, food_id, name, qty, selling_price, shop_price)
    select v_order_id, f.id, f.name, (i.value)::int, f.selling_price, f.shop_price
    from jsonb_each_text(r.items) i join public.foods f on f.id = i.key::uuid;

    insert into public.order_codes (order_id, code) values (v_order_id, r.code);

    insert into public.order_events (order_id, type, actor_id, data, created_at)
    values (v_order_id, 'placed', r.customer_id,
            jsonb_build_object('items_selling_total', v_selling, 'delivery_fee', 100, 'seed', true),
            now() - interval '3 hours');
    if r.status in ('assigned', 'picked_up', 'delivered') then
      insert into public.order_events (order_id, type, actor_id, data, created_at)
      values (v_order_id, 'assigned', v_admin, jsonb_build_object('rider_id', v_kasun), now() - interval '1 hour');
    end if;
    if r.status in ('picked_up', 'delivered') then
      insert into public.order_events (order_id, type, actor_id, data, created_at)
      values (v_order_id, 'picked_up', v_kasun, '{}', now() - interval '30 minutes');
    end if;
    if r.status = 'delivered' then
      insert into public.order_events (order_id, type, actor_id, data, created_at)
      values (v_order_id, 'delivered', v_kasun, jsonb_build_object('method', 'code'), now() - interval '10 minutes');
    end if;
    if r.status = 'cancelled' then
      insert into public.order_events (order_id, type, actor_id, data, created_at)
      values (v_order_id, 'cancelled', r.customer_id, jsonb_build_object('by', 'customer'), now() - interval '2 hours');
    end if;
  end loop;
end;
$$;
