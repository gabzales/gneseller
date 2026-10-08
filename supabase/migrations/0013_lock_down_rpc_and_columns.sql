-- 0013 — Lock down SECURITY DEFINER RPCs and sensitive columns.
-- Safe to re-run. Run AFTER 0012.
--
-- PROBLEM
--   Postgres grants EXECUTE on every new function to PUBLIC by default, and
--   Supabase additionally auto-grants it to anon/authenticated. None of the
--   migrations 0001-0012 revoked that for the SECURITY DEFINER functions, and
--   0010 even granted admin_set_total_topup() to `authenticated` explicitly.
--   Their p_user_id / p_admin_id arguments are caller-supplied and are NOT
--   checked against auth.uid(), so any signed-in user (or anyone holding the
--   public anon key) could call them straight from the browser via
--   supabase.rpc(...) and:
--     - settle_topup()/admin_adjust_balance()/admin_set_total_topup() -> mint balance
--     - generate_key_manual() -> pull real keys out of key_stock
--     - generate_key() with a self-chosen p_key_string -> forge history rows
--   Every legitimate caller in src/ uses the service-role client
--   (createAdminSupabase), which is unaffected by these revokes.
--
-- FIX
--   Revoke EXECUTE from PUBLIC/anon/authenticated on all of them, and make
--   that the default for functions created later.

do $$
declare
  sig text;
begin
  foreach sig in array array[
    'public.handle_new_auth_user()',
    'public.check_rate_limit(text,integer,integer)',
    'public.settle_topup(text,uuid,bigint,bigint)',
    'public.create_pending_topup(uuid,text,bigint,bigint)',
    'public.generate_key(uuid,text,text,text)',
    'public.generate_key_manual(uuid,text,text)',
    'public.admin_adjust_balance(uuid,uuid,bigint,text)',
    'public.admin_set_total_topup(uuid,uuid,bigint,text)',
    'public.assert_not_banned(uuid)',
    'public.send_broadcast(uuid,text,text)',
    'public.effective_key_price(uuid,text,text,bigint)'
  ] loop
    if to_regprocedure(sig) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', sig);
      execute format('grant execute on function %s to service_role', sig);
    end if;
  end loop;
end $$;

-- Future functions in public: no implicit EXECUTE for browser roles.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- product_durations is readable by anon/authenticated (public catalogue), but
-- provider_item_id is the internal id of the upstream provider's catalogue
-- and has no business in the browser. Column-level grant: everything except it.
-- (All browser-side reads in src/ select explicit columns id,label,days,price;
-- admin screens use the service-role client.)
revoke select on public.product_durations from anon, authenticated;
grant select (id, product_id, label, days, price, stock_mode)
  on public.product_durations to anon, authenticated;
