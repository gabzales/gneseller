-- GhostSeller — admin manual balance adjustment (top up saldo reseller di
-- luar QRIS/GensPay, mis. transfer manual/bonus/koreksi), sama seperti
-- fitur adjustBalance di GHOST NEWERA. Run after 0003_admin_provider.sql.

-- ────────────────────────────────────────────────────────────────────────
-- 1. balance_adjustments — audit trail: siapa admin-nya, ke user mana,
--    berapa, kenapa. Admin-only (service role), tidak pernah dibuka ke
--    anon/authenticated langsung.
-- ────────────────────────────────────────────────────────────────────────
create table if not exists public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users (id) on delete set null,
  user_id uuid not null references public.users (id) on delete cascade,
  amount bigint not null check (amount <> 0), -- positive = tambah, negative = kurangi
  note text,
  created_at timestamptz not null default now()
);

create index if not exists balance_adjustments_user_idx
  on public.balance_adjustments (user_id, created_at desc);

alter table public.balance_adjustments enable row level security;
revoke all on public.balance_adjustments from anon, authenticated;
-- No policies on purpose -- service-role only, same pattern as
-- rate_limit_hits / key_stock / app_settings.

-- ────────────────────────────────────────────────────────────────────────
-- 2. RPC: admin_adjust_balance — atomically credits/debits a reseller's
--    balance and logs it. No upper bound on the amount (admin is trusted
--    by definition -- the only floor enforced is the same `balance >= 0`
--    check every other balance mutation already respects, so a deduction
--    still can't push someone negative).
--
--    A positive amount also creates a matching row in `topups` with
--    method = 'MANUAL' so the reseller sees it plainly in their own
--    History Top Up instead of a balance that silently jumped with no
--    paper trail on their side. Negative adjustments (corrections) are
--    NOT mirrored into topups -- there's no such thing as a "negative
--    top up" from the reseller's point of view; those stay recorded in
--    balance_adjustments only, which is admin-facing.
-- ────────────────────────────────────────────────────────────────────────
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

  update public.users set balance = balance + p_amount where id = p_user_id
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
