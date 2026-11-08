#!/usr/bin/env bash
# Stores the sms-dispatch URL and secret in the LOCAL database's Vault so queued
# order SMS are delivered (to the console provider). Run after `supabase start` / `db reset`.
set -euo pipefail
cd "$(dirname "$0")/.."
source supabase/.env
DB_CONTAINER="supabase_db_nearbuy"
URL="http://supabase_kong_nearbuy:8000/functions/v1/sms-dispatch"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q <<SQL
delete from vault.secrets where name in ('sms_dispatch_url', 'sms_dispatch_secret');
select vault.create_secret('$URL', 'sms_dispatch_url');
select vault.create_secret('$SMS_DISPATCH_SECRET', 'sms_dispatch_secret');
SQL
echo "Vault configured: sms_dispatch_url=$URL"
