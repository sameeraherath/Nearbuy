-- Row Level Security: who can read and write what.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- Helpers -------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create function tests.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Seed ids
-- admin  a0000000-0000-4000-8000-000000000001
-- kasun  b0000000-0000-4000-8000-000000000011 (has orders 2,3,4)
-- thari  b0000000-0000-4000-8000-000000000012 (no orders)
-- ishara c0000000-0000-4000-8000-000000000001 (orders 1,4)
-- dilini c0000000-0000-4000-8000-000000000002 (orders 2,5)

-- Anonymous -----------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from public.shops), 4, 'anon sees active shops');
select is((select count(*)::int from public.menu_foods), 18, 'anon sees menu');
select is((select count(*)::int from public.places), 7, 'anon sees places');
select is((select count(*)::int from public.public_settings), 1, 'anon sees public settings');
select throws_ok('select shop_price from public.menu_foods', '42703', null, 'menu_foods hides shop_price');
select throws_ok('select * from public.orders', '42501', null, 'anon cannot read orders');
select throws_ok('select * from public.order_codes', '42501', null, 'anon cannot read codes');
select throws_ok('select * from public.foods', '42501', null, 'anon cannot read foods table (shop prices)');
select throws_ok('select * from public.settings', '42501', null, 'anon cannot read settings table');
select throws_ok('select * from public.my_orders', '42501', null, 'anon cannot read my_orders');
select throws_ok($$update public.shops set name = 'x'$$, '42501', null, 'anon cannot write through (updatable) views');
select throws_ok(
  $$select public.place_order('d0000000-0000-4000-8000-000000000001', '[]', '{}')$$,
  '42501', null, 'anon cannot call place_order');

-- Customer ------------------------------------------------------------------
select tests.as_user('c0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.my_orders), 2, 'customer sees own orders only');
select is((select count(*)::int from public.my_order_items), 4, 'customer sees own order items only');
select is((select count(*)::int from public.order_codes), 2, 'customer sees own delivery codes');
select is((select count(*)::int from public.orders), 0, 'customer cannot read orders table (shop totals)');
select is((select count(*)::int from public.profiles), 1, 'customer sees only own profile');
select is((select count(*)::int from public.sms_messages), 0, 'customer cannot read sms log');
select is((select count(*)::int from public.order_events), 0, 'customer cannot read event log');
select is((select count(*)::int from public.customer_locations), 1, 'customer sees own saved location');
select throws_ok($$update public.profiles set role = 'admin'$$, '42501', null, 'customer cannot change role');
select throws_ok($$update public.profiles set is_blocked = false$$, '42501', null, 'customer cannot unblock self');
select throws_ok(
  $$insert into public.businesses (name) values ('Fake shop')$$, '42501', null, 'customer cannot add businesses');
select throws_ok(
  $$update public.order_codes set code = '0000'$$, '42501', null, 'customer cannot change codes');
select lives_ok(
  $$insert into public.customer_locations (customer_id, label, lat, lng)
    values ('c0000000-0000-4000-8000-000000000001', 'Library', 6.714, 80.786)$$,
  'customer can save own location');
select throws_ok(
  $$insert into public.customer_locations (customer_id, label, lat, lng)
    values ('c0000000-0000-4000-8000-000000000002', 'Library', 6.714, 80.786)$$,
  '42501', null, 'customer cannot save a location for someone else');
select throws_ok(
  $$select public.assign_orders(array(select id from public.my_orders), 'b0000000-0000-4000-8000-000000000011')$$,
  'P0001', 'NB_FORBIDDEN', 'customer cannot assign orders');

-- Rider ---------------------------------------------------------------------
select tests.as_user('b0000000-0000-4000-8000-000000000011');
select is((select count(*)::int from public.orders), 3, 'rider sees assigned orders');
select is((select count(*)::int from public.order_items), 4, 'rider sees items of assigned orders');
select is((select count(*)::int from public.order_codes), 0, 'rider can NEVER read delivery codes');
select is((select count(*)::int from public.sms_messages), 0, 'rider cannot read sms log (contains codes)');
select is((select count(*)::int from public.customer_locations), 0, 'rider cannot read saved locations');
select throws_ok($$update public.orders set status = 'delivered'$$, '42501', null, 'rider cannot update orders directly');

select tests.as_user('b0000000-0000-4000-8000-000000000012');
select is((select count(*)::int from public.orders), 0, 'other rider sees none of them');

-- Admin ---------------------------------------------------------------------
select tests.as_user('a0000000-0000-4000-8000-000000000001');
select is((select count(*)::int from public.orders), 5, 'admin sees all orders');
select is((select count(*)::int from public.order_codes), 5, 'admin sees codes');
select is((select count(*)::int from public.foods), 18, 'admin sees foods with shop prices');
select lives_ok($$update public.settings set min_order_amount = 300$$, 'admin can update settings');
select lives_ok($$insert into public.places (name, lat, lng) values ('Library', 6.714, 80.786)$$, 'admin can add places');
select throws_ok($$update public.profiles set role = 'admin'$$, '42501', null, 'even admins cannot change roles via the API');

select tests.as_postgres();
select * from finish();
rollback;
