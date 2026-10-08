-- GhostSeller — admin authority: product CRUD, manual key stock pool,
-- reseller-provider (vipibmstore.com) integration for auto-generated keys.
-- Run AFTER 0001_init.sql and 0002_production_hardening.sql. Safe to re-run.

-- ────────────────────────────────────────────────────────────────────────
-- 1. product_durations — stock mode per duration, same idea as GHOSTNEWERA
--    (settings.json stockMode): 'manual' draws from key_stock below,
--    'auto' calls the reseller provider live at generate time.
--    provider_item_id is the matched item id in the provider's own
--    catalog (picked by admin from /api/admin/provider/products), only
--    meaningful when stock_mode = 'auto'.
-- ────────────────────────────────────────────────────────────────────────
alter table public.product_durations
  add column if not exists stock_mode text not null default 'manual'
    check (stock_mode in ('manual', 'auto'));
alter table public.product_durations
  add column if not exists provider_item_id text;

-- ────────────────────────────────────────────────────────────────────────
-- 2. key_stock — manual pool of not-yet-sold keys, one row per key.
--    Admin bulk-pastes keys in the product editor; generate_key_manual()
--    below atomically claims one row per sale (FOR UPDATE SKIP LOCKED so
--    concurrent purchases never hand out the same key twice).
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.key_stock (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  duration_id text not null,
  key_string text not null,
  used boolean not null default false,
  used_by uuid references public.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (product_id, duration_id)
    references public.product_durations (product_id, id) on delete cascade
);

create index if not exists key_stock_available_idx
  on public.key_stock (product_id, duration_id)
  where used = false;

-- ────────────────────────────────────────────────────────────────────────
-- 3. app_settings — small key/value store for admin-configured settings
--    that shouldn't live in env vars alone (mirrors GHOSTNEWERA's
--    settings.json). Currently just the reseller_api credentials for
--    vipibmstore.com. Service-role only: no grants to anon/authenticated
--    at all, exactly like rate_limit_hits.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────
-- 4. RPC: generate_key_manual — same balance-check-and-debit contract as
--    generate_key(), but the key comes from the manual pool instead of
--    being passed in. Used when the duration's stock_mode = 'manual'.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.generate_key_manual(
  p_user_id uuid,
  p_product_id text,
  p_duration_id text
)
returns public.reseller_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price bigint;
  v_label text;
  v_product_name text;
  v_balance bigint;
  v_stock_id uuid;
  v_key_string text;
  v_row public.reseller_keys;
begin
  select pd.price, pd.label, p.name
    into v_price, v_label, v_product_name
  from public.product_durations pd
  join public.products p on p.id = pd.product_id
  where pd.product_id = p_product_id and pd.id = p_duration_id;

  if v_price is null then
    raise exception 'invalid_product_or_duration';
  end if;

  select balance into v_balance from public.users where id = p_user_id for update;

  if v_balance is null then
    raise exception 'user_not_found';
  end if;

  if v_balance < v_price then
    raise exception 'insufficient_balance';
  end if;

  select id, key_string into v_stock_id, v_key_string
  from public.key_stock
  where product_id = p_product_id and duration_id = p_duration_id and used = false
  order by created_at asc
  limit 1
  for update skip locked;

  if v_stock_id is null then
    raise exception 'out_of_stock';
  end if;

  update public.key_stock
    set used = true, used_by = p_user_id, used_at = now()
    where id = v_stock_id;

  update public.users set balance = balance - v_price where id = p_user_id;

  insert into public.reseller_keys (user_id, product_id, product_name, duration_label, price, key_string)
  values (p_user_id, p_product_id, v_product_name, v_label, v_price, v_key_string)
  returning * into v_row;

  return v_row;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 5. RLS — key_stock and app_settings are admin/service-role only. Product
--    reads for resellers still go through the existing public.products /
--    product_durations policies (unchanged); stock_mode and
--    provider_item_id are internal fields the storefront query never
--    selects, but REVOKE keeps that enforced at the DB layer too, not
--    just by convention in the query.
-- ────────────────────────────────────────────────────────────────────────
alter table public.key_stock enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.key_stock, public.app_settings from anon, authenticated;
-- No policies created on purpose: zero grants means zero access for
-- anon/authenticated regardless of policy, matching rate_limit_hits.
-- Only the service-role client (src/lib/supabase/admin.ts) can touch
-- these two tables, and every route that does first calls requireAdmin().

-- products / product_durations already have admin-safe read policies
-- from 0001; admin write access to those goes through the service-role
-- client too (see src/app/api/admin/**), so no policy changes needed
-- there -- anon/authenticated were never granted insert/update/delete.
