# Nearbuy

Campus food delivery for students near Sabaragamuwa University, Belihuloya.
Students order before the daily cutoff. Riders buy the food from shops in cash and deliver it in one batch. Payment is cash on delivery, and a 4-digit code proves each delivery.

> **Status:** the backend (database, security rules, order logic, SMS plumbing) is live on Supabase. The admin panel (`apps/admin`), customer app (`apps/customer`) and rider app (`apps/rider`) are built on top of it.

## Repository layout

```
apps/admin/           Next.js admin panel: orders board, assign riders, shops & menus, places, riders, customers, settings, SMS log
apps/customer/        Expo app for students: shops, menu, cart, checkout, live order tracking with delivery code
apps/rider/           Expo app for riders: today's pick-ups by shop, item unavailable, picked up, deliver with code
packages/shared/      @nearbuy/shared: DB types, zod schemas, money/time/fee/phone helpers, constants
supabase/
  config.toml         local Supabase config (phone-only auth, Send SMS hook, test OTPs)
  migrations/         schema, helpers + views, RLS, order functions, realtime/storage/SMS
  seed.sql            Sri Lankan dev data (shops, foods, places, users, today's orders)
  tests/              pgTAP tests (RLS + order functions)
  functions/          Edge Functions: send-sms-hook, sms-dispatch, _shared/sms provider interface
scripts/dev-vault.sh  configures the local DB to call sms-dispatch
```

## Running the apps

Each app reads the Supabase URL and publishable key from its own env file (copy the `.env.example` next to it).

| App | Env file | Run |
| --- | --- | --- |
| Admin | `apps/admin/.env.local` | `pnpm --filter @nearbuy/admin dev` → http://localhost:3000 |
| Customer | `apps/customer/.env` | `pnpm --filter @nearbuy/customer start` → scan the QR code with Expo Go |
| Rider | `apps/rider/.env` | `pnpm --filter @nearbuy/rider start` → scan the QR code with Expo Go |

The admin panel also needs `SUPABASE_SERVICE_ROLE_KEY` (server-only) to create rider accounts.

### Deploying the admin panel (Vercel)

1. Import the GitHub repo in Vercel.
2. **Root Directory:** `apps/admin` (framework preset: Next.js).
3. **Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy.

### Deploying the customer web app (Vercel)

The customer app also runs in the browser (same code, Expo web).

1. In Vercel, add a **second** project from the same repo.
2. **Root Directory:** `apps/customer`. Build settings come from `apps/customer/vercel.json` (`expo export --platform web` → `dist`).
3. **Environment variables:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Deploy.

### Building the mobile apps

Use Expo Build (EAS) from each app folder: `npx eas-cli@latest build --platform android --profile preview` gives an installable APK. Set the two `EXPO_PUBLIC_*` variables as EAS environment variables.

## Prerequisites

- Node 22 (`.nvmrc`) and pnpm (`corepack enable pnpm`)
- Docker (for the local Supabase stack)

## Setup

```bash
pnpm install
cp supabase/.env.example supabase/.env      # then fill the two secrets (commands are in the file)
pnpm db:start                               # starts Supabase, applies migrations, loads seed
./scripts/dev-vault.sh                      # lets the DB trigger the SMS dispatcher locally
```

`pnpm supabase status` prints the local URLs and keys. Studio is at http://127.0.0.1:54323.

### Dev logins

The seed numbers below log in with code **123456** (`[auth.sms.test_otp]` in `config.toml`, **local only**). Any other Sri Lankan number gets a real 6-digit code, which is printed in the Edge Function logs by the console SMS provider (`docker logs -f supabase_edge_runtime_nearbuy`).

| Role     | Phone           | Name                   |
| -------- | --------------- | ---------------------- |
| Admin    | +94 76 495 2122 | amsh                   |
| Rider    | +94 77 000 0011 | Kasun Bandara          |
| Rider    | +94 77 000 0012 | Tharindu Silva         |
| Customer | +94 77 111 1111 | Ishara Fernando        |
| Customer | +94 77 222 2222 | Dilini Jayasinghe      |
| Customer | +94 77 333 3333 | Ravindu Wickramasinghe |

The seed has five of today's orders, NB-2001 to NB-2005: placed, assigned, picked up, delivered and cancelled.

## Commands

| Command                                        | What it does                                                    |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `pnpm test`                                    | Unit tests (money, cutoff, fees, phone, error mapping)          |
| `pnpm db:test`                                 | pgTAP tests for RLS and the order functions                     |
| `pnpm db:reset`                                | Re-apply all migrations and the seed (run `dev-vault.sh` after) |
| `pnpm db:types`                                | Regenerate `packages/shared/src/database.types.ts`              |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | Quality checks                                                  |

## How the backend works

### Security model

- **RLS is on for every table.** Clients never write orders directly. Every order change goes through a Postgres function (`security definer`). Each function checks the caller's role, the order status and the cutoff.
- **Customers read through views** that leave out shop prices, shop totals and rider pay: `shops`, `menu_foods`, `public_settings`, `my_orders`, `my_order_items`. The `foods`, `orders` and `settings` tables are visible only to admins (and, for `orders`, to the assigned rider).
- **Delivery codes** (`order_codes`) can be read only by the order's customer and by admins. Riders can never read them, and the code check happens inside `confirm_delivery`.
- **Roles** come from `auth.users.raw_app_meta_data.role`, which only the service role can set. Nobody can change `profiles.role` or `is_blocked` through the API. Blocking goes through `admin_set_customer_blocked`.
- Only Sri Lankan mobiles (`+947XXXXXXXX`) can sign up (enforced by the profile trigger and the SMS hook).

### Order functions (RPC)

| Function                                                                                 | Caller         | Rule                                                                                                                               |
| ---------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `place_order(business_id, items, location, customer_name?, save_location?, client_ref?)` | customer       | Cutoff, one shop, prices read from the DB, minimum order, delivery fee, unique 4-digit code, SMS. `client_ref` makes retries safe. |
| `cancel_order(order_id)`                                                                 | customer       | Own order, `placed`, before today's cutoff                                                                                         |
| `assign_orders(order_ids[], rider_id)`                                                   | admin          | Bulk assign. `null` rider = unassign. Only `placed`/`assigned` orders.                                                             |
| `rider_set_item_unavailable(order_item_id, unavailable)`                                 | assigned rider | Before pickup. Recalculates totals and texts the new total.                                                                        |
| `rider_mark_picked_up(order_ids[])`                                                      | assigned rider | Per order or per shop group. Safe to retry.                                                                                        |
| `confirm_delivery(order_id, code)`                                                       | assigned rider | Only when `picked_up`. Locks after 3 wrong codes. Sets `rider_pay`.                                                                |
| `admin_override_delivery(order_id, reason, note?)`                                       | admin          | `phone_off` / `paid_in_person` / `other` (+ note). Flagged on the order.                                                           |
| `admin_cancel_order(order_id, reason?)`                                                  | admin          | Any open order                                                                                                                     |
| `admin_set_customer_blocked(phone, blocked)`                                             | admin          |                                                                                                                                    |
| `is_registered_staff(phone, role)`                                                       | anyone         | Lets the rider app say "not registered as a rider" before sending a code                                                           |

Errors are raised as `NB_<CODE>` (e.g. `NB_MIN_ORDER:300`). `serverErrorMessage()` in `@nearbuy/shared` turns them into user text such as "Minimum order is Rs 300". Every state change is written to `order_events`.

### Realtime

A trigger broadcasts order changes on private channels: `order:<id>` for the customer, `rider:<rider_id>` and `admin:orders`. Each payload has only the id and status. The apps then refetch through the RLS-protected reads.

### SMS

- **Login codes:** Supabase Auth → **Send SMS hook** → `send-sms-hook` Edge Function → provider. It is logged in `sms_messages` with the code hidden.
- **Order messages:** order functions add rows to `sms_messages` (an outbox) in the same transaction. A trigger (via `pg_net`) and a once-a-minute `pg_cron` sweep call `sms-dispatch`, which sends each row and records the result.
- **Providers** implement `SmsProvider` (`supabase/functions/_shared/sms/types.ts`), chosen by `SMS_PROVIDER`. `console` logs messages (the default for development). Text.lk arrives in Phase 6, and Notify.lk or Dialog can be added the same way.

## Deploying the backend (summary; full guide in Phase 7)

1. Create a Supabase project in **Singapore (ap-southeast-1)** or **Mumbai (ap-south-1)**.
2. `pnpm supabase link --project-ref <ref>` → `pnpm supabase db push`. Do **not** run `seed.sql` in production.
3. `pnpm supabase functions deploy send-sms-hook sms-dispatch` and `pnpm supabase secrets set --env-file <prod env>`.
4. Dashboard → Auth → Hooks → Send SMS → HTTPS → `https://<ref>.supabase.co/functions/v1/send-sms-hook` with the same secret. Enable the Phone provider.
5. In the SQL editor, run:
   `select vault.create_secret('https://<ref>.supabase.co/functions/v1/sms-dispatch', 'sms_dispatch_url');`
   `select vault.create_secret('<SMS_DISPATCH_SECRET>', 'sms_dispatch_secret');`
6. Create the first admin: create a phone user with app metadata `{"role":"admin","full_name":"…"}` (Dashboard → Auth → Add user, or the Admin API).
