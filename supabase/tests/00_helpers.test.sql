-- Shared test helpers. Each test file creates them inside its own transaction,
-- so this file only checks that the seed data the other tests rely on exists.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is((select count(*)::int from public.profiles where role = 'admin'), 1, 'seed: one admin');
select is((select count(*)::int from public.riders), 2, 'seed: two riders');
select is((select count(*)::int from public.profiles where role = 'customer' and id::text like 'c0000000-%'), 3, 'seed: three customers');
select is((select count(*)::int from public.orders), 5, 'seed: five orders');

select * from finish();
rollback;
