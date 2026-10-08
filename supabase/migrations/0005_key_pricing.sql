-- GhostSeller — harga key bertingkat (tier berdasarkan total top up) +
-- harga khusus per reseller (custom, admin pilih user tertentu). Run
-- after 0004_manual_balance.sql.
--
-- Prioritas harga saat generate key (lihat effective_key_price() di
-- bawah), dari yang paling spesifik ke paling umum:
--   1. custom_prices   -- admin set harga khusus untuk 1 user + 1 durasi
--   2. price_tiers     -- harga otomatis berdasarkan total_topup user,
--                          ambil tier tertinggi yang masih <= total_topup
--   3. product_durations.price -- harga default, dipakai kalau tidak ada
--                          override sama sekali

-- ────────────────────────────────────────────────────────────────────────
-- 1. users.total_topup — akumulasi lifetime top up SUKSES (QRIS via
--    settle_topup() maupun manual via admin_adjust_balance()), dipakai
--    sebagai patokan tier. Terpisah dari `balance` (yang bisa berkurang
--    saat beli key) supaya tier reseller tidak turun lagi cuma karena
--    saldonya kepakai.
-- ────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists total_topup bigint not null default 0;

-- Backfill dari histori topups sukses yang sudah ada (baik QRIS maupun
-- method='MANUAL' dari admin_adjust_balance) supaya tier langsung akurat
-- untuk reseller lama, bukan cuma reseller baru setelah migration ini.
update public.users u
set total_topup = coalesce((
  select sum(t.total) from public.topups t
  where t.user_id = u.id and t.status = 'success'
), 0)
where total_topup = 0;

-- ────────────────────────────────────────────────────────────────────────
-- 2. price_tiers — harga per (product_id, duration_id) yang berlaku kalau
--    total_topup user >= min_total_topup. Beberapa tier boleh ada untuk
--    durasi yang sama (mis. >=500rb, >=1jt, >=5jt) -- effective_key_price()
--    di bawah otomatis ambil yang tertinggi yang masih terpenuhi.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.price_tiers (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  duration_id text not null,
  min_total_topup bigint not null check (min_total_topup >= 0),
  price bigint not null check (price >= 0),
  created_at timestamptz not null default now(),
  foreign key (product_id, duration_id)
    references public.product_durations (product_id, id) on delete cascade,
  unique (product_id, duration_id, min_total_topup)
);

create index if not exists price_tiers_lookup_idx
  on public.price_tiers (product_id, duration_id, min_total_topup desc);

-- ────────────────────────────────────────────────────────────────────────
-- 3. custom_prices — harga khusus admin pilih 1 user + 1 durasi. Selalu
--    menang di atas price_tiers kalau ada baris yang cocok persis.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.custom_prices (
  user_id uuid not null references public.users (id) on delete cascade,
  product_id text not null,
  duration_id text not null,
  price bigint not null check (price >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, product_id, duration_id),
  foreign key (product_id, duration_id)
    references public.product_durations (product_id, id) on delete cascade
);

-- ────────────────────────────────────────────────────────────────────────
-- 4. effective_key_price() — dipanggil dari generate_key() /
--    generate_key_manual() menggantikan pd.price langsung.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.effective_key_price(
  p_user_id uuid,
  p_product_id text,
  p_duration_id text,
  p_default_price bigint
)
returns bigint
language plpgsql
stable
set search_path = public
as $$
declare
  v_custom bigint;
  v_tier bigint;
  v_total_topup bigint;
begin
  select price into v_custom
  from public.custom_prices
  where user_id = p_user_id and product_id = p_product_id and duration_id = p_duration_id;

  if v_custom is not null then
    return v_custom;
  end if;

  select total_topup into v_total_topup from public.users where id = p_user_id;

  select price into v_tier
  from public.price_tiers
  where product_id = p_product_id
    and duration_id = p_duration_id
    and min_total_topup <= coalesce(v_total_topup, 0)
  order by min_total_topup desc
  limit 1;

  if v_tier is not null then
    return v_tier;
  end if;

  return p_default_price;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 5. generate_key() / generate_key_manual() — swap pd.price for
--    effective_key_price(pd.price) as the charged price. Balance debit
--    and reseller_keys.price both use the effective price now, so
--    History Key Generate shows what was actually charged, not the
--    catalog default.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.generate_key(
  p_user_id uuid,
  p_product_id text,
  p_duration_id text,
  p_key_string text
)
returns public.reseller_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_price bigint;
  v_price bigint;
  v_label text;
  v_product_name text;
  v_balance bigint;
  v_row public.reseller_keys;
begin
  select pd.price, pd.label, p.name
    into v_default_price, v_label, v_product_name
  from public.product_durations pd
  join public.products p on p.id = pd.product_id
  where pd.product_id = p_product_id and pd.id = p_duration_id;

  if v_default_price is null then
    raise exception 'invalid_product_or_duration';
  end if;

  v_price := public.effective_key_price(p_user_id, p_product_id, p_duration_id, v_default_price);

  select balance into v_balance from public.users where id = p_user_id for update;

  if v_balance is null then
    raise exception 'user_not_found';
  end if;

  if v_balance < v_price then
    raise exception 'insufficient_balance';
  end if;

  update public.users set balance = balance - v_price where id = p_user_id;

  insert into public.reseller_keys (user_id, product_id, product_name, duration_label, price, key_string)
  values (p_user_id, p_product_id, v_product_name, v_label, v_price, p_key_string)
  returning * into v_row;

  return v_row;
end;
$$;

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
  v_default_price bigint;
  v_price bigint;
  v_label text;
  v_product_name text;
  v_balance bigint;
  v_stock_id uuid;
  v_key_string text;
  v_row public.reseller_keys;
begin
  select pd.price, pd.label, p.name
    into v_default_price, v_label, v_product_name
  from public.product_durations pd
  join public.products p on p.id = pd.product_id
  where pd.product_id = p_product_id and pd.id = p_duration_id;

  if v_default_price is null then
    raise exception 'invalid_product_or_duration';
  end if;

  v_price := public.effective_key_price(p_user_id, p_product_id, p_duration_id, v_default_price);

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
-- 6. settle_topup() / admin_adjust_balance() — also accumulate
--    total_topup so tiers move up as a reseller keeps topping up.
--    settle_topup() always represents a real successful top up, so it
--    always adds. admin_adjust_balance() only adds when amount > 0 --
--    matches its existing "mirror into topups" condition (negative
--    adjustments are corrections, not top ups, so they must NOT reduce
--    total_topup and reset a reseller's earned tier).
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.settle_topup(
  p_provider_ref text,
  p_user_id uuid,
  p_nominal bigint,
  p_bonus bigint
)
returns public.topups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.topups;
begin
  select * into v_row from public.topups where provider_ref = p_provider_ref;

  if found then
    return v_row; -- already settled, no-op (idempotent)
  end if;

  insert into public.topups (user_id, nominal, bonus, total, status, provider_ref, settled_at)
  values (p_user_id, p_nominal, p_bonus, p_nominal + p_bonus, 'success', p_provider_ref, now())
  returning * into v_row;

  update public.users
    set balance = balance + v_row.total, total_topup = total_topup + v_row.total
    where id = p_user_id;

  return v_row;
end;
$$;

create or replace function public.admin_adjust_balance(
  p_admin_id uuid,
  p_user_id uuid,
  p_amount bigint,
  p_note text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
begin
  if p_amount = 0 then
    raise exception 'invalid_amount';
  end if;

  select * into v_user from public.users where id = p_user_id for update;
  if v_user is null then
    raise exception 'user_not_found';
  end if;

  if v_user.balance + p_amount < 0 then
    raise exception 'insufficient_balance';
  end if;

  update public.users
    set balance = balance + p_amount,
        total_topup = total_topup + greatest(p_amount, 0)
    where id = p_user_id
    returning * into v_user;

  insert into public.balance_adjustments (admin_id, user_id, amount, note)
  values (p_admin_id, p_user_id, p_amount, p_note);

  if p_amount > 0 then
    insert into public.topups (user_id, nominal, bonus, total, method, status, provider_ref, settled_at)
    values (p_user_id, p_amount, 0, p_amount, 'MANUAL', 'success', 'ADJ-' || gen_random_uuid()::text, now());
  end if;

  return v_user;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 7. RLS — same "service-role only" pattern as key_stock/app_settings:
--    zero grants to anon/authenticated, no policies. Every route that
--    reads/writes these goes through getAdminUser() first.
-- ────────────────────────────────────────────────────────────────────────
alter table public.price_tiers enable row level security;
alter table public.custom_prices enable row level security;

revoke all on public.price_tiers, public.custom_prices from anon, authenticated;
