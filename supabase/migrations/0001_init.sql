-- GhostSeller schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on the SAME
-- project that ghostnewera.web.id already uses (PRD 1: shared database).
--
-- Idempotent-ish: safe to re-run, uses IF NOT EXISTS / OR REPLACE.

-- ────────────────────────────────────────────────────────────────────────
-- 1. users — one row per Supabase Auth user, source of truth for balance
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  balance bigint not null default 0 check (balance >= 0),
  role text not null default 'user' check (role in ('user', 'admin')),
  verified boolean not null default false,
  source_domain text not null default 'ghostseller.my.id',
  created_at timestamptz not null default now()
);

-- Auto-create a users row the moment an account exists in auth.users --
-- which, since there's no public sign-up form, only happens when an
-- admin creates one (Supabase Dashboard -> Authentication -> Add User,
-- or the Admin API) after approving a reseller over WhatsApp.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ────────────────────────────────────────────────────────────────────────
-- 2. products / product_durations — pulled from the central catalog
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null default 'General',
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.product_durations (
  id text not null,
  product_id text not null references public.products (id) on delete cascade,
  label text not null,
  days int not null,
  price bigint not null check (price >= 0),
  primary key (product_id, id)
);

-- ────────────────────────────────────────────────────────────────────────
-- 3. reseller_keys — every key a reseller has generated
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.reseller_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id text not null references public.products (id),
  product_name text not null,
  duration_label text not null,
  price bigint not null,
  key_string text not null,
  created_at timestamptz not null default now()
);

create index if not exists reseller_keys_user_idx
  on public.reseller_keys (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────
-- 4. topups — QRIS deposit transactions
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  nominal bigint not null check (nominal > 0),
  bonus bigint not null default 0,
  total bigint not null,
  method text not null default 'QRIS',
  status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
  provider_ref text unique, -- external gateway transaction id, for webhook idempotency
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists topups_user_idx
  on public.topups (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────
-- 5. RPC: generate_key — atomic "check balance → debit → insert key"
--    Called from the server route with the service role so RLS is
--    bypassed here on purpose; the route itself authenticates the caller.
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
  v_price bigint;
  v_label text;
  v_product_name text;
  v_balance bigint;
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

  update public.users set balance = balance - v_price where id = p_user_id;

  insert into public.reseller_keys (user_id, product_id, product_name, duration_label, price, key_string)
  values (p_user_id, p_product_id, v_product_name, v_label, v_price, p_key_string)
  returning * into v_row;

  return v_row;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 6. RPC: settle_topup — called by the QRIS webhook handler once the
--    payment gateway confirms a successful payment. Idempotent on
--    provider_ref so a retried webhook can't double-credit balance.
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

  update public.users set balance = balance + v_row.total where id = p_user_id;

  return v_row;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 7. Row Level Security (PRD 5)
-- ────────────────────────────────────────────────────────────────────────
-- IMPORTANT: RLS policies restrict which ROWS a role can touch, not which
-- COLUMNS. Supabase grants broad table privileges to `anon`/`authenticated`
-- by default, so without the explicit REVOKE/GRANT block below, a signed-in
-- user could call `supabase.from('users').update({ balance: 999999999 })`
-- from the browser and — because the row-level check `auth.uid() = id`
-- would pass — actually succeed. Column-level privileges close that gap.
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.product_durations enable row level security;
alter table public.reseller_keys enable row level security;
alter table public.topups enable row level security;

revoke all on public.users, public.reseller_keys, public.topups
  from anon, authenticated;
revoke all on public.products, public.product_durations
  from anon, authenticated;

grant select on public.products, public.product_durations to anon, authenticated;
grant select on public.users, public.reseller_keys, public.topups to authenticated;
-- Only these two columns are ever safe for a user to change themselves.
-- balance / role / verified are writable ONLY via generate_key() /
-- settle_topup() (SECURITY DEFINER, called with the service_role key).
grant update (full_name, avatar_url) on public.users to authenticated;

drop policy if exists "users read own row" on public.users;
create policy "users read own row" on public.users
  for select using (auth.uid() = id);

drop policy if exists "users update own non-balance fields" on public.users;
create policy "users update own non-balance fields" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
  -- The GRANT above already limits this to (full_name, avatar_url) at the
  -- column level — this row-level policy only adds "must be your own row"
  -- on top of that. Never widen the GRANT to include balance/role/verified.

drop policy if exists "anyone can read active products" on public.products;
create policy "anyone can read active products" on public.products
  for select using (active = true);

drop policy if exists "anyone can read durations" on public.product_durations;
create policy "anyone can read durations" on public.product_durations
  for select using (true);

drop policy if exists "users read own keys" on public.reseller_keys;
create policy "users read own keys" on public.reseller_keys
  for select using (auth.uid() = user_id);

drop policy if exists "users read own topups" on public.topups;
create policy "users read own topups" on public.topups
  for select using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────
-- 8. Seed products (safe to edit / re-run)
-- ────────────────────────────────────────────────────────────────────────
insert into public.products (id, name, category, sort_order) values
  ('hg-apkmod-ff', 'HG APKMOD FF', 'Free Fire', 1),
  ('drip-client-root', 'Drip Client Root', 'Free Fire', 2),
  ('fluorite-ios-mlbb', 'Fluorite iOS MLBB', 'Mobile Legends', 3),
  ('aurora-vn-pc', 'Aurora VN PC', 'PC', 4)
on conflict (id) do nothing;

insert into public.product_durations (id, product_id, label, days, price) values
  ('1d', 'hg-apkmod-ff', '1 Day', 1, 8000),
  ('7d', 'hg-apkmod-ff', '7 Days', 7, 45000),
  ('10d', 'hg-apkmod-ff', '10 Days', 10, 60000),
  ('30d', 'hg-apkmod-ff', '30 Days', 30, 150000),
  ('1d', 'drip-client-root', '1 Day', 1, 10000),
  ('7d', 'drip-client-root', '7 Days', 7, 55000),
  ('30d', 'drip-client-root', '30 Days', 30, 180000),
  ('1d', 'fluorite-ios-mlbb', '1 Day', 1, 12000),
  ('7d', 'fluorite-ios-mlbb', '7 Days', 7, 65000),
  ('30d', 'fluorite-ios-mlbb', '30 Days', 30, 210000),
  ('1d', 'aurora-vn-pc', '1 Day', 1, 15000),
  ('30d', 'aurora-vn-pc', '30 Days', 30, 250000)
on conflict (product_id, id) do nothing;
