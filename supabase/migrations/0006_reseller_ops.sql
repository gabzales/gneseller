-- GhostSeller — 4 fitur lanjutan dari daftar revisi 123.md:
--   1. Ban/hapus reseller
--   2. Edit nominal/bonus paket top up (dulu hardcoded di mock-data.ts)
--   3. Broadcast notifikasi ke semua reseller
--   4. Riwayat key lintas-reseller yang bisa dilihat admin (bukan cuma
--      "punya sendiri" seperti getKeyHistory() yang sudah ada)
-- Run after 0005_key_pricing.sql.

-- ────────────────────────────────────────────────────────────────────────
-- 1. BAN RESELLER
--    Soft-ban dulu (banned=true) supaya reversible dan tidak menghapus
--    histori key/topup reseller yang mungkin masih relevan buat rekap.
--    Hard delete tetap disediakan sebagai endpoint terpisah (lihat route),
--    dengan ON DELETE CASCADE yang sudah ada dari 0001 (reseller_keys,
--    topups, balance_adjustments, custom_prices semua cascade ke users).
-- ────────────────────────────────────────────────────────────────────────
alter table public.users
  add column if not exists banned boolean not null default false;

alter table public.users
  add column if not exists banned_at timestamptz;

-- Dicek di getCurrentUser()/getAdminUser() dan di setiap RPC yang
-- mengubah saldo (generate_key, generate_key_manual, settle_topup lewat
-- webhook, admin_adjust_balance) supaya reseller yang dibanned tidak bisa
-- login-session-nya dipakai untuk transaksi baru meski token masih valid.
create or replace function public.assert_not_banned(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_banned boolean;
begin
  select banned into v_banned from public.users where id = p_user_id;
  if v_banned then
    raise exception 'user_banned';
  end if;
end;
$$;

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
  perform public.assert_not_banned(p_user_id);

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
  perform public.assert_not_banned(p_user_id);

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

-- settle_topup dipanggil dari webhook (server-to-server, tidak ada sesi
-- reseller di baliknya) -- tetap diblokir supaya reseller yang dibanned
-- tapi transaksi QRIS-nya kepending sebelum banned tidak ke-settle diam-
-- diam sesudahnya.
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

  perform public.assert_not_banned(p_user_id);

  insert into public.topups (user_id, nominal, bonus, total, status, provider_ref, settled_at)
  values (p_user_id, p_nominal, p_bonus, p_nominal + p_bonus, 'success', p_provider_ref, now())
  returning * into v_row;

  update public.users
    set balance = balance + v_row.total, total_topup = total_topup + v_row.total
    where id = p_user_id;

  return v_row;
end;
$$;

-- Admin sendiri boleh tetap adjust saldo reseller yang dibanned (misal
-- buat koreksi/refund sebelum hard-delete), jadi admin_adjust_balance
-- SENGAJA tidak dipasangi assert_not_banned di sini.

-- ────────────────────────────────────────────────────────────────────────
-- 2. TOPUP PACKAGES — dulu array statis TOPUP_PACKAGES di
--    src/lib/mock-data.ts, sekarang tabel supaya admin bisa ubah nominal
--    & bonus tanpa redeploy. topup/create route baca dari sini (fallback
--    ke TOPUP_PACKAGES kalau tabel kosong, lihat kode route).
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.topup_packages (
  id uuid primary key default gen_random_uuid(),
  nominal bigint not null check (nominal > 0),
  bonus bigint not null default 0 check (bonus >= 0),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (nominal)
);

alter table public.topup_packages enable row level security;
-- Reseller harus bisa BACA daftar paket (halaman Top Up), tapi tidak
-- pernah menulis -- sama pola dengan products/product_durations di 0001.
revoke all on public.topup_packages from anon, authenticated;
grant select on public.topup_packages to authenticated;

drop policy if exists "topup packages readable" on public.topup_packages;
create policy "topup packages readable" on public.topup_packages
  for select using (true);

-- Seed dari TOPUP_PACKAGES yang sudah ada supaya tidak ada gap nominal
-- begitu tabel ini mulai dipakai (kalau tabel masih kosong).
insert into public.topup_packages (nominal, bonus, sort_order)
select v.nominal, v.bonus, v.sort_order
from (values
  (500000, 50000, 1),
  (1000000, 150000, 2),
  (1500000, 350000, 3),
  (2000000, 500000, 4),
  (3000000, 700000, 5),
  (5000000, 1300000, 6),
  (10000000, 2300000, 7),
  (15000000, 4000000, 8),
  (20000000, 7000000, 9)
) as v(nominal, bonus, sort_order)
where not exists (select 1 from public.topup_packages);

-- ────────────────────────────────────────────────────────────────────────
-- 3. BROADCAST NOTIFIKASI — admin kirim 1 pesan ke semua reseller.
--    broadcast_reads melacak siapa sudah baca (buat titik merah/badge di
--    Bell icon), bukan siapa sudah "menerima" -- broadcast selalu
--    langsung kelihatan untuk semua reseller begitu dikirim, tidak ada
--    per-user targeting di versi ini (bisa ditambah nanti kalau perlu).
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.users (id) on delete set null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists broadcasts_created_idx
  on public.broadcasts (created_at desc);

create table if not exists public.broadcast_reads (
  broadcast_id uuid not null references public.broadcasts (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (broadcast_id, user_id)
);

alter table public.broadcasts enable row level security;
alter table public.broadcast_reads enable row level security;

-- Reseller boleh baca semua broadcast (tidak ada info sensitif per-user
-- di sini) tapi tidak boleh insert/update/delete langsung -- pengiriman
-- selalu lewat route admin (service role).
revoke all on public.broadcasts from anon, authenticated;
grant select on public.broadcasts to authenticated;

drop policy if exists "broadcasts readable by signed-in users" on public.broadcasts;
create policy "broadcasts readable by signed-in users" on public.broadcasts
  for select using (auth.uid() is not null);

-- broadcast_reads: reseller boleh baca & tulis HANYA baris miliknya
-- sendiri (menandai broadcast tertentu sudah dibaca).
revoke all on public.broadcast_reads from anon, authenticated;
grant select, insert on public.broadcast_reads to authenticated;

drop policy if exists "users read own broadcast reads" on public.broadcast_reads;
create policy "users read own broadcast reads" on public.broadcast_reads
  for select using (auth.uid() = user_id);

drop policy if exists "users mark own broadcast reads" on public.broadcast_reads;
create policy "users mark own broadcast reads" on public.broadcast_reads
  for insert with check (auth.uid() = user_id);

-- RPC dipanggil dari route admin (service role) supaya admin_id tercatat
-- konsisten dan tidak bisa dipalsukan dari client.
create or replace function public.send_broadcast(
  p_admin_id uuid,
  p_title text,
  p_body text
)
returns public.broadcasts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.broadcasts;
begin
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then
    raise exception 'invalid_broadcast';
  end if;

  insert into public.broadcasts (admin_id, title, body)
  values (p_admin_id, trim(p_title), trim(p_body))
  returning * into v_row;

  return v_row;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 4. RIWAYAT KEY ADMIN (lintas semua reseller) — view read-only, service
--    role only. Reseller tetap hanya bisa lihat punya sendiri lewat
--    getKeyHistory() yang sudah ada (RLS reseller_keys tidak berubah).
-- ────────────────────────────────────────────────────────────────────────
create or replace view public.admin_key_history as
select
  rk.id,
  rk.user_id,
  u.full_name,
  u.email,
  rk.product_id,
  rk.product_name,
  rk.duration_label,
  rk.price,
  rk.key_string,
  rk.created_at
from public.reseller_keys rk
join public.users u on u.id = rk.user_id
order by rk.created_at desc;

revoke all on public.admin_key_history from anon, authenticated;
-- No grant at all -- read exclusively via createAdminSupabase() (service
-- role bypasses RLS/grants), same pattern as key_stock/app_settings.
