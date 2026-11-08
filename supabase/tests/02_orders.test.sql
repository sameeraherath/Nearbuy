-- Order functions: place, cancel, assign, unavailable item, pick up, confirm code, override, block.
begin;
create extension if not exists pgtap with schema extensions;
select plan(64);

create schema tests;
grant usage on schema tests to anon, authenticated;
create function tests.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
-- remember a value across statements
create function tests.put(k text, v text) returns text language sql as $$ select set_config('tests.' || k, v, true) $$;
create function tests.get(k text) returns text language sql as $$ select current_setting('tests.' || k) $$;

-- Ids
--   admin   a0000000-0000-4000-8000-000000000001
--   kasun   b0000000-0000-4000-8000-000000000011
--   thari   b0000000-0000-4000-8000-000000000012
--   ishara  c0000000-0000-4000-8000-000000000001
--   dilini  c0000000-0000-4000-8000-000000000002
--   kottu corner d…01: chicken kottu f…101 (800/850), egg kottu f…102 (600/650), iced milo f…105 (unavailable)
--   bakehouse d…03: tea f…305 (50/60)
--   hostel block c e…03

-- Open for ordering, standard fees
update public.settings set cutoff_time = '23:59:59.999', ordering_enabled = true,
  delivery_fee = 100, free_delivery_over = null, free_delivery_until = null, min_order_amount = 300,
  rider_pay_per_delivery = 60;

-- ===========================================================================
-- place_order
-- ===========================================================================
select tests.as_user('c0000000-0000-4000-8000-000000000001');

select tests.put('o1', (public.place_order(
  'd0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":2,"price":1},
    {"food_id":"f0000000-0000-4000-8000-000000000102","qty":1}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003","room":"Room 214","note":"Call me"}'
) ->> 'order_id'));

select tests.as_postgres();
select is((select items_selling_total from public.orders where id = tests.get('o1')::uuid), 2350,
  'place_order: selling total from DB prices (client price ignored)');
select is((select items_shop_total from public.orders where id = tests.get('o1')::uuid), 2200, 'place_order: shop total');
select is((select delivery_fee from public.orders where id = tests.get('o1')::uuid), 100, 'place_order: delivery fee');
select is((select total_to_collect from public.orders where id = tests.get('o1')::uuid), 2450, 'place_order: total to collect');
select is((select status::text from public.orders where id = tests.get('o1')::uuid), 'placed', 'place_order: status placed');
select is((select location_label from public.orders where id = tests.get('o1')::uuid), 'Hostel Block C', 'place_order: label from place');
select is((select customer_phone from public.orders where id = tests.get('o1')::uuid), '+94771111111', 'place_order: phone snapshot');
select is((select delivery_date from public.orders where id = tests.get('o1')::uuid),
  (now() at time zone 'Asia/Colombo')::date, 'place_order: Colombo delivery date');
select is((select count(*)::int from public.order_items where order_id = tests.get('o1')::uuid), 2, 'place_order: two lines');
select matches((select code from public.order_codes where order_id = tests.get('o1')::uuid), '^[0-9]{4}$', 'place_order: 4-digit code');
select is((select count(*)::int from public.order_events where order_id = tests.get('o1')::uuid and type = 'placed'), 1, 'place_order: event logged');
select ok((select body like '%' || (select code from public.order_codes where order_id = tests.get('o1')::uuid) || '%'
                        and body like '%Pay Rs 2,450 cash%'
           from public.sms_messages where order_id = tests.get('o1')::uuid and kind = 'order_placed'),
  'place_order: confirmation SMS queued with code and total');

-- Prices change later — existing order is unaffected
update public.foods set selling_price = 999, shop_price = 950 where id = 'f0000000-0000-4000-8000-000000000101';
select is((select selling_price from public.order_items where order_id = tests.get('o1')::uuid
           and food_id = 'f0000000-0000-4000-8000-000000000101'), 850, 'price snapshot survives price changes');
update public.foods set selling_price = 850, shop_price = 800 where id = 'f0000000-0000-4000-8000-000000000101';

-- Validation
select tests.as_user('c0000000-0000-4000-8000-000000000001');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000003',
  '[{"food_id":"f0000000-0000-4000-8000-000000000305","qty":1}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_MIN_ORDER:300', 'rejects orders below the minimum');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000305","qty":10}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_FOOD_UNAVAILABLE', 'rejects food from another shop (one business per order)');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000105","qty":2}, {"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_FOOD_UNAVAILABLE', 'rejects unavailable food');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":0}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_BAD_QTY', 'rejects qty 0');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":15},{"food_id":"f0000000-0000-4000-8000-000000000101","qty":6}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_BAD_QTY', 'merged duplicate lines over 20 are rejected');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1.5}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_BAD_QTY', 'rejects fractional qty');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[]', '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_EMPTY_CART', 'rejects an empty cart');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]',
  '{"label":"Somewhere","lat":51.5,"lng":-0.12}')$$,
  'P0001', 'NB_LOCATION_REQUIRED', 'rejects a location outside Sri Lanka');
select lives_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]',
  '{"label":"My boarding","room":"2","lat":6.7101,"lng":80.7815}')$$,
  'accepts a GPS pin location');

-- Idempotent retry
select tests.put('r1', (public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000102","qty":1}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}', null, true,
  '11111111-1111-4111-8111-111111111111') ->> 'order_id'));
select is((public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000102","qty":1}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000003"}', null, true,
  '11111111-1111-4111-8111-111111111111') ->> 'order_id'), tests.get('r1'),
  'retry with the same client_ref returns the same order');

-- Saved default location
select is((select count(*)::int from public.customer_locations where is_default), 1, 'one default location');
select is((select label from public.customer_locations where is_default), 'Hostel Block C', 'default location updated');

-- Free delivery promo
select tests.as_postgres();
update public.settings set free_delivery_over = 1500, free_delivery_until = (now() at time zone 'Asia/Colombo')::date;
select tests.as_user('c0000000-0000-4000-8000-000000000002');
select is((public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":2}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000001"}') ->> 'delivery_fee')::int, 0,
  'free delivery at/over threshold until the end date');
select is((public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000001"}') ->> 'delivery_fee')::int, 100,
  'fee charged below threshold');
select tests.as_postgres();
update public.settings set free_delivery_until = (now() at time zone 'Asia/Colombo')::date - 1;
select tests.as_user('c0000000-0000-4000-8000-000000000002');
select is((public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":2}]',
  '{"place_id":"e0000000-0000-4000-8000-000000000001"}') ->> 'delivery_fee')::int, 100,
  'free delivery ends after the until date');
select tests.as_postgres();
update public.settings set free_delivery_over = null, free_delivery_until = null;

-- Roles and blocking
select tests.as_user('b0000000-0000-4000-8000-000000000011');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]', '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_FORBIDDEN', 'riders cannot place orders');

select tests.as_user('a0000000-0000-4000-8000-000000000001');
select lives_ok($$select public.admin_set_customer_blocked('+94773333333', true)$$, 'admin blocks a customer');
select tests.as_user('c0000000-0000-4000-8000-000000000003');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]', '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_BLOCKED', 'blocked customers cannot order');

-- ===========================================================================
-- cancel_order
-- ===========================================================================
select tests.as_user('c0000000-0000-4000-8000-000000000002');
select throws_ok(format('select public.cancel_order(%L)', tests.get('o1')),
  'P0001', 'NB_ORDER_NOT_FOUND', 'cannot cancel someone else''s order');

select tests.as_user('c0000000-0000-4000-8000-000000000001');
select lives_ok(format('select public.cancel_order(%L)', tests.get('r1')), 'customer cancels own placed order');
select is((select status::text from public.my_orders where id = tests.get('r1')::uuid), 'cancelled', 'order is cancelled');

-- Cutoff passed
select tests.as_postgres();
update public.settings set cutoff_time = '00:00';
select tests.as_user('c0000000-0000-4000-8000-000000000001');
select throws_ok(format('select public.cancel_order(%L)', tests.get('o1')),
  'P0001', 'NB_ORDERING_CLOSED', 'cannot cancel after the cutoff');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]', '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_ORDERING_CLOSED', 'cannot order after the cutoff');
select tests.as_postgres();
update public.settings set cutoff_time = '23:59:59.999', ordering_enabled = false;
select tests.as_user('c0000000-0000-4000-8000-000000000001');
select throws_ok($$select public.place_order('d0000000-0000-4000-8000-000000000001',
  '[{"food_id":"f0000000-0000-4000-8000-000000000101","qty":1}]', '{"place_id":"e0000000-0000-4000-8000-000000000003"}')$$,
  'P0001', 'NB_ORDERING_CLOSED', 'cannot order when ordering is switched off');
select tests.as_postgres();
update public.settings set ordering_enabled = true;

-- ===========================================================================
-- assign_orders
-- ===========================================================================
select tests.as_user('a0000000-0000-4000-8000-000000000001');
select is(public.assign_orders(array[tests.get('o1')::uuid], 'b0000000-0000-4000-8000-000000000011'), 1, 'admin assigns an order');
select is((select status::text from public.orders where id = tests.get('o1')::uuid), 'assigned', 'status assigned');
select throws_ok(format('select public.assign_orders(array[%L::uuid], %L)', tests.get('r1'), 'b0000000-0000-4000-8000-000000000011'),
  'P0001', 'NB_BAD_STATUS', 'cannot assign a cancelled order');
select throws_ok(format('select public.assign_orders(array[%L::uuid], %L)', tests.get('o1'), 'c0000000-0000-4000-8000-000000000002'),
  'P0001', 'NB_RIDER_NOT_FOUND', 'cannot assign to a non-rider');

select tests.as_user('c0000000-0000-4000-8000-000000000001');
select throws_ok(format('select public.cancel_order(%L)', tests.get('o1')),
  'P0001', 'NB_BAD_STATUS', 'customer cannot cancel once assigned');

-- ===========================================================================
-- rider: unavailable item, pick up
-- ===========================================================================
select tests.as_user('b0000000-0000-4000-8000-000000000012');
select throws_ok(format('select public.rider_mark_picked_up(array[%L::uuid])', tests.get('o1')),
  'P0001', 'NB_ORDER_NOT_FOUND', 'another rider cannot pick up the order');

select tests.as_user('b0000000-0000-4000-8000-000000000011');
select tests.put('egg_item', (select id::text from public.order_items
  where order_id = tests.get('o1')::uuid and food_id = 'f0000000-0000-4000-8000-000000000102'));
select is((public.rider_set_item_unavailable(tests.get('egg_item')::uuid, true) ->> 'total_to_collect')::int, 1800,
  'marking an item unavailable recalculates the total');
select is((select items_shop_total from public.orders where id = tests.get('o1')::uuid), 1600, 'shop total recalculated');

select tests.as_postgres();
select ok(exists (select 1 from public.sms_messages where order_id = tests.get('o1')::uuid
  and kind = 'item_unavailable' and body like '%New total: Rs 1,800 cash%'), 'customer is texted the new total');
select is((select count(*)::int from public.order_events where order_id = tests.get('o1')::uuid and type = 'item_unavailable'), 1,
  'unavailable item logged');

select tests.as_user('b0000000-0000-4000-8000-000000000011');
select is(public.rider_mark_picked_up(array[tests.get('o1')::uuid]), 1, 'rider marks picked up');
select is(public.rider_mark_picked_up(array[tests.get('o1')::uuid]), 0, 'picking up again is a no-op');
select throws_ok(format('select public.rider_set_item_unavailable(%L::uuid, false)', tests.get('egg_item')),
  'P0001', 'NB_BAD_STATUS', 'cannot change items after pickup');

-- ===========================================================================
-- confirm_delivery
-- ===========================================================================
select tests.as_postgres();
select tests.put('code1', (select code from public.order_codes where order_id = tests.get('o1')::uuid));
select tests.put('wrong1', lpad(((tests.get('code1')::int + 1) % 10000)::text, 4, '0'));

select tests.as_user('b0000000-0000-4000-8000-000000000012');
select throws_ok(format('select public.confirm_delivery(%L, %L)', tests.get('o1'), tests.get('code1')),
  'P0001', 'NB_ORDER_NOT_FOUND', 'only the assigned rider can confirm');

select tests.as_user('b0000000-0000-4000-8000-000000000011');
select is(public.confirm_delivery(tests.get('o1')::uuid, tests.get('wrong1')),
  '{"result":"wrong_code","attempts_left":2}'::jsonb, 'wrong code: 2 tries left');
select is(public.confirm_delivery(tests.get('o1')::uuid, tests.get('code1')),
  '{"result":"delivered","attempts_left":2}'::jsonb, 'right code delivers');
select is((select status::text from public.orders where id = tests.get('o1')::uuid), 'delivered', 'status delivered');
select is((select rider_pay from public.orders where id = tests.get('o1')::uuid), 60, 'rider pay set on delivery');
select isnt((select delivered_at from public.orders where id = tests.get('o1')::uuid), null, 'delivered_at set');

-- Lockout after 3 wrong codes (seed order NB-2003 is picked_up by Kasun, code 9041)
select tests.put('o3', (select id::text from public.orders where order_number = 'NB-2003'));
select is(public.confirm_delivery(tests.get('o3')::uuid, '0000') ->> 'result', 'wrong_code', 'wrong 1');
select is(public.confirm_delivery(tests.get('o3')::uuid, '0001') ->> 'result', 'wrong_code', 'wrong 2');
select is(public.confirm_delivery(tests.get('o3')::uuid, '0002'),
  '{"result":"locked","attempts_left":0}'::jsonb, 'third wrong code locks');
select is(public.confirm_delivery(tests.get('o3')::uuid, '9041') ->> 'result', 'locked', 'correct code after lock is still locked');
select is((select status::text from public.orders where id = tests.get('o3')::uuid), 'picked_up', 'locked order not delivered');

-- ===========================================================================
-- admin override
-- ===========================================================================
select tests.as_user('a0000000-0000-4000-8000-000000000001');
select throws_ok(format('select public.admin_override_delivery(%L, %L)', tests.get('o3'), 'other'),
  'P0001', 'NB_REASON_REQUIRED', '"other" needs a note');
select lives_ok(format('select public.admin_override_delivery(%L, %L)', tests.get('o3'), 'phone_off'),
  'admin overrides with a reason');
select is((select delivered_by_override and override_reason = 'phone_off' and status = 'delivered'
           from public.orders where id = tests.get('o3')::uuid), true, 'override flagged on the order');

select tests.as_postgres();
select * from finish();
rollback;
