-- BUG FIX: settle_topup() inserted a BRAND NEW row on success instead of
-- updating the existing 'pending' row that create_pending_topup() had
-- already inserted at checkout time -- and that new row never had
-- merchant_ref set at all (only user_id/nominal/bonus/total/status/
-- provider_ref/settled_at were in the insert's column list).
--
-- Two user-visible symptoms follow directly from that:
--
--   1. GET /api/topup/status?ref=<merchant_ref> (polled by the QR modal
--      while waiting for payment) filters strictly by merchant_ref. Once
--      settled, the ORIGINAL row (merchant_ref = order_id, status =
--      'pending') is left completely untouched forever -- the NEW
--      'success' row is a separate row with merchant_ref = null, so this
--      query can never find it. The QR modal would poll forever and
--      show "Menunggu" indefinitely even after balance was actually
--      credited correctly.
--
--   2. Top-up History (queried by user_id, not merchant_ref) shows BOTH
--      rows for what was really a single transaction: the original
--      stuck at "pending" forever, plus a separate "success" entry --
--      i.e. exactly the duplicated/confusing "ada history-nya tapi
--      kayak nyangkut" symptom that's been reported.
--
-- Fix: keep the exact same 4-parameter signature (no overload risk, see
-- 0007) but change the body to UPDATE the existing pending row in place
-- rather than inserting a new one. In this codebase's design,
-- `p_provider_ref` (GensPay's order_id, echoed back on the webhook) is
-- ALWAYS the same string create_pending_topup() stored as `merchant_ref`
-- at checkout time (see topup/create/route.ts) -- so looking that row
-- up by merchant_ref = p_provider_ref and updating it is safe and exact,
-- no ambiguity about which row it refers to.
--
-- Falls back to inserting a fresh row only if no matching pending row
-- exists (e.g. a manually-triggered settle with no prior checkout, or a
-- pending row that was deleted) -- preserves the old behavior for any
-- edge case rather than failing outright.
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
  -- Idempotency: if this exact provider_ref was already settled (retry
  -- from GensPay, or a re-run of the debug resettle tool), return the
  -- already-settled row as a no-op rather than settling twice.
  select * into v_row from public.topups where provider_ref = p_provider_ref and status = 'success';
  if found then
    return v_row;
  end if;

  perform public.assert_not_banned(p_user_id);

  -- Update the existing pending row in place, matched by merchant_ref
  -- (== p_provider_ref in this codebase's design -- see comment above).
  -- Also guarded by status = 'pending' so this can't accidentally
  -- re-settle/overwrite a row some other path already finalized.
  update public.topups
    set status = 'success',
        provider_ref = p_provider_ref,
        nominal = p_nominal,
        bonus = p_bonus,
        total = p_nominal + p_bonus,
        settled_at = now()
    where merchant_ref = p_provider_ref
      and status = 'pending'
    returning * into v_row;

  if not found then
    -- No matching pending row -- fall back to inserting fresh rather
    -- than silently doing nothing, same safety net the old version had.
    insert into public.topups (user_id, nominal, bonus, total, status, provider_ref, merchant_ref, settled_at)
    values (p_user_id, p_nominal, p_bonus, p_nominal + p_bonus, 'success', p_provider_ref, p_provider_ref, now())
    returning * into v_row;
  end if;

  update public.users
    set balance = balance + v_row.total, total_topup = total_topup + v_row.total
    where id = p_user_id;

  return v_row;
end;
$$;
