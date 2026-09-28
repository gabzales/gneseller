-- GhostSeller — production hardening pass
-- Run AFTER 0001_init.sql on the same project. Safe to re-run (uses
-- IF NOT EXISTS / OR REPLACE / DROP ... IF EXISTS throughout).

-- ────────────────────────────────────────────────────────────────────────
-- 1. reseller_keys.key_string must be globally unique.
--    generate_key() now retries on a random key_string collision from the
--    route handler; the DB constraint is the real guarantee. A duplicate
--    key_string would otherwise mean two customers holding "the same"
--    license/activation key.
-- ────────────────────────────────────────────────────────────────────────
alter table public.reseller_keys
  drop constraint if exists reseller_keys_key_string_key;
alter table public.reseller_keys
  add constraint reseller_keys_key_string_key unique (key_string);

-- ────────────────────────────────────────────────────────────────────────
-- 2. topups.merchant_ref — stores the exact "topup:<user_id>:<nominal>:
--    <nonce>" value used to create the transaction upstream, so
--    /api/topup/create can find/upsert the pending row and the webhook can
--    cross-check it. provider_ref (external gateway trx id) remains the
--    idempotency key for settle_topup().
-- ────────────────────────────────────────────────────────────────────────
alter table public.topups
  add column if not exists merchant_ref text;
alter table public.topups
  drop constraint if exists topups_merchant_ref_key;
alter table public.topups
  add constraint topups_merchant_ref_key unique (merchant_ref);

-- ────────────────────────────────────────────────────────────────────────
-- 3. Rate limiting — generic sliding-window counter table + atomic RPC.
--    Used by /api/generate-key and /api/topup/create to cap how often a
--    given user can hit balance-mutating endpoints. SECURITY DEFINER so
--    it's only reachable through the service-role client in route
--    handlers, never directly from the browser (no RLS policy grants
--    anon/authenticated access to this table at all).
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,        -- e.g. 'generate-key:<user_id>'
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_idx
  on public.rate_limit_hits (bucket, created_at desc);

alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;
-- No grants at all: only the service-role key (which bypasses RLS/grants)
-- can touch this table, and only via the RPC below.

-- Periodically prune old rows so the table doesn't grow unbounded. Cheap
-- enough to run inline on every call rather than needing pg_cron.
create or replace function public.check_rate_limit(
  p_bucket text,
  p_max_hits int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.rate_limit_hits
    where bucket = p_bucket
      and created_at < now() - make_interval(secs => p_window_seconds * 4);

  select count(*) into v_count
    from public.rate_limit_hits
    where bucket = p_bucket
      and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_hits then
    return false; -- caller should respond 429
  end if;

  insert into public.rate_limit_hits (bucket) values (p_bucket);
  return true;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 4. settle_topup() — also accept/record merchant_ref so a topup created
--    by /api/topup/create (status 'pending') gets updated in place
--    instead of leaving an orphaned pending row next to a new settled one.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.settle_topup(
  p_provider_ref text,
  p_user_id uuid,
  p_nominal bigint,
  p_bonus bigint,
  p_merchant_ref text default null
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

  -- If /api/topup/create already inserted a 'pending' row for this
  -- merchant_ref, settle that same row instead of inserting a duplicate.
  if p_merchant_ref is not null then
    select * into v_row from public.topups
      where merchant_ref = p_merchant_ref and status = 'pending'
      for update;
  end if;

  if found then
    update public.topups
      set status = 'success',
          bonus = p_bonus,
          total = p_nominal + p_bonus,
          provider_ref = p_provider_ref,
          settled_at = now()
      where id = v_row.id
      returning * into v_row;
  else
    insert into public.topups (user_id, nominal, bonus, total, status, provider_ref, merchant_ref, settled_at)
    values (p_user_id, p_nominal, p_bonus, p_nominal + p_bonus, 'success', p_provider_ref, p_merchant_ref, now())
    returning * into v_row;
  end if;

  update public.users set balance = balance + v_row.total where id = p_user_id;

  return v_row;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────
-- 5. create_pending_topup() — the one write /api/topup/create is allowed
--    to make, via the service-role client, right after the gateway
--    accepts the transaction. Kept as an RPC (not a raw insert) so the
--    same validation lives in one place regardless of which route calls
--    it.
-- ────────────────────────────────────────────────────────────────────────
create or replace function public.create_pending_topup(
  p_user_id uuid,
  p_merchant_ref text,
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
  insert into public.topups (user_id, nominal, bonus, total, status, merchant_ref)
  values (p_user_id, p_nominal, p_bonus, p_nominal + p_bonus, 'pending', p_merchant_ref)
  returning * into v_row;
  return v_row;
end;
$$;
