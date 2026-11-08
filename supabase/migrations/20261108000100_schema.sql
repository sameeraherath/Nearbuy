-- Nearbuy core schema: types and tables.
-- Money is integer LKR rupees. Times are timestamptz. Business dates use Asia/Colombo.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
comment on schema private is 'Internal helpers. Not exposed through the Data API.';

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'rider', 'admin');
create type public.order_status as enum ('placed', 'assigned', 'picked_up', 'delivered', 'cancelled');
create type public.override_reason as enum ('phone_off', 'paid_in_person', 'other');
create type public.sms_kind as enum (
  'login_code', 'order_placed', 'item_unavailable', 'picked_up', 'delivered', 'order_cancelled', 'other'
);
create type public.sms_status as enum ('queued', 'sending', 'sent', 'delivered', 'failed', 'undelivered');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  full_name text not null default '' check (char_length(full_name) <= 60),
  phone text not null unique check (phone ~ '^\+947[0-9]{8}$'),
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);
comment on column public.profiles.phone is 'E.164 Sri Lankan mobile, e.g. +94771234567';

create table public.riders (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  vehicle_note text not null default '' check (char_length(vehicle_note) <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  token text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_profile_idx on public.push_tokens (profile_id);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  area text not null default '',
  phone text,
  cuisine_tags text[] not null default '{}',
  cover_photo_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index businesses_active_sort_idx on public.businesses (is_active, sort_order);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  category text not null default 'Other',
  photo_path text,
  shop_price integer not null check (shop_price >= 0),
  selling_price integer not null check (selling_price >= 0),
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index foods_business_idx on public.foods (business_id, category, sort_order);

-- ---------------------------------------------------------------------------
-- Locations
-- ---------------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.customer_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid references public.places (id) on delete set null,
  label text not null check (char_length(label) between 1 and 80),
  room text not null default '' check (char_length(room) <= 40),
  note text not null default '' check (char_length(note) <= 200),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index customer_locations_customer_idx on public.customer_locations (customer_id);
create unique index customer_locations_one_default
  on public.customer_locations (customer_id) where is_default;

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id boolean primary key default true check (id),
  cutoff_time time not null default '18:00',
  delivery_window_text text not null default '7–8 PM',
  ordering_enabled boolean not null default true,
  delivery_fee integer not null default 100 check (delivery_fee >= 0),
  free_delivery_over integer check (free_delivery_over >= 0),
  free_delivery_until date,
  min_order_amount integer not null default 300 check (min_order_amount >= 0),
  rider_pay_per_delivery integer not null default 60 check (rider_pay_per_delivery >= 0),
  help_phone text not null default '',
  updated_at timestamptz not null default now()
);
comment on column public.settings.free_delivery_until is 'Inclusive Colombo date. NULL = no end date.';
insert into public.settings (id) values (true);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start with 2001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('NB-' || nextval('public.order_number_seq')),
  customer_id uuid not null references public.profiles (id),
  business_id uuid not null references public.businesses (id),
  delivery_date date not null,
  status public.order_status not null default 'placed',

  -- location snapshot
  location_place_id uuid references public.places (id) on delete set null,
  location_label text not null,
  location_room text not null default '',
  location_note text not null default '',
  location_lat double precision not null,
  location_lng double precision not null,

  -- customer snapshot
  customer_name text not null default '',
  customer_phone text not null,

  -- money snapshot
  items_selling_total integer not null check (items_selling_total >= 0),
  items_shop_total integer not null check (items_shop_total >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  total_to_collect integer not null check (total_to_collect >= 0),
  rider_id uuid references public.riders (profile_id),
  rider_pay integer not null default 0 check (rider_pay >= 0),

  placed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  delivered_by_override boolean not null default false,
  override_reason public.override_reason,
  override_note text,
  code_attempts integer not null default 0 check (code_attempts >= 0),
  -- Idempotency key from the app, so a retried "Place order" on a flaky connection
  -- returns the same order instead of creating a duplicate.
  client_ref uuid,
  unique (customer_id, client_ref),

  constraint orders_total_matches check (total_to_collect = items_selling_total + delivery_fee),
  constraint orders_override_reason check (not delivered_by_override or override_reason is not null),
  constraint orders_rider_when_assigned check (status in ('placed', 'cancelled') or rider_id is not null)
);
create index orders_delivery_date_idx on public.orders (delivery_date, status);
create index orders_customer_idx on public.orders (customer_id, placed_at desc);
create index orders_rider_idx on public.orders (rider_id, delivery_date);
create index orders_business_idx on public.orders (business_id, delivery_date);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  name text not null,
  qty integer not null check (qty between 1 and 20),
  selling_price integer not null check (selling_price >= 0),
  shop_price integer not null check (shop_price >= 0),
  is_unavailable boolean not null default false
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_codes (
  order_id uuid primary key references public.orders (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$')
);
comment on table public.order_codes is 'Delivery codes. Readable only by the order''s customer and admins — never riders.';

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  type text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- SMS log / outbox
-- ---------------------------------------------------------------------------
create table public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  kind public.sms_kind not null,
  to_phone text not null,
  body text not null,
  order_id uuid references public.orders (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  status public.sms_status not null default 'queued',
  provider text,
  provider_message_id text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  status_updated_at timestamptz
);
comment on column public.sms_messages.body is 'Message text. Login codes are stored redacted.';
create index sms_messages_queue_idx on public.sms_messages (created_at) where status = 'queued';
create index sms_messages_order_idx on public.sms_messages (order_id);
create index sms_messages_provider_id_idx on public.sms_messages (provider, provider_message_id);
