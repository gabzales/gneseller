-- BUG FIX: settle_topup() has silently existed as TWO overloaded functions
-- since 0002_production_hardening.sql, and every single webhook/self-test
-- settlement attempt since has failed because of it.
--
-- Timeline:
--   0001_init.sql                 settle_topup(text, uuid, bigint, bigint)              -- 4 params
--   0002_production_hardening.sql settle_topup(text, uuid, bigint, bigint, text default null) -- 5 params
--   0005_key_pricing.sql          settle_topup(text, uuid, bigint, bigint)              -- 4 params
--   0006_reseller_ops.sql         settle_topup(text, uuid, bigint, bigint)              -- 4 params
--
-- `create or replace function` only replaces a function whose parameter
-- COUNT and TYPES match exactly. 0002 added a 5th parameter, so it did
-- NOT replace 0001's version -- it created a second, separate overloaded
-- function. 0005 and 0006 both went back to the original 4-parameter
-- shape, so each of those replaced the 4-param version in turn -- but
-- 0002's 5-param version was never touched again by anything. It has
-- been sitting in the database the entire time, orphaned but still
-- fully callable.
--
-- Because 0002's 5th parameter (`p_merchant_ref`) has `default null`,
-- that 5-param function can ALSO be called with just 4 arguments --
-- Postgres fills in the default for the missing one. That means every
-- 4-argument call to settle_topup() is genuinely ambiguous: BOTH the
-- 4-param function (from 0006) and the 5-param function (from 0002,
-- using its default) are equally valid matches. PostgREST detects this
-- ambiguity and refuses to guess, rejecting the call outright with
-- PGRST203 ("Could not choose the best candidate function") -- before
-- either function's body ever runs.
--
-- This is why balance crediting failed 100% of the time regardless of
-- whether the webhook was reached at all: the RPC call itself was being
-- rejected by PostgREST's function resolution, not by any application
-- logic inside settle_topup.
--
-- Fix: drop the orphaned 5-param overload, leaving exactly one
-- settle_topup() function (the current 4-param version from
-- 0006_reseller_ops.sql) so calls resolve unambiguously.
drop function if exists public.settle_topup(text, uuid, bigint, bigint, text);

-- Sanity check: confirm exactly one settle_topup overload remains after
-- this migration runs. If this raises, something above didn't work as
-- expected and needs a human to look before assuming this is fixed.
do $$
declare
  v_count int;
begin
  select count(*) into v_count
  from pg_proc
  where proname = 'settle_topup'
    and pronamespace = 'public'::regnamespace;

  if v_count <> 1 then
    raise exception 'Expected exactly 1 settle_topup() overload after cleanup, found %', v_count;
  end if;
end;
$$;
