-- FEATURE: admin panel could only VIEW total_topup (used for automatic
-- tier pricing, see 0005_key_pricing.sql), never directly edit it.
-- admin_adjust_balance() only ever INCREASES total_topup (by design --
-- 0005's comment explicitly says this prevents an admin/reseller from
-- gaming tiers backward by requesting a "refund" via Kurangi and keeping
-- an already-earned tier). But that same one-way design means there was
-- also no way to CORRECT a total_topup that ended up too high for the
-- wrong reason -- e.g. a manual courtesy credit or refund adjustment
-- given via Tambah in the past also silently counted toward tier
-- eligibility, inflating it beyond what the reseller's real qualifying
-- topups justify.
--
-- This RPC sets total_topup to an explicit value chosen by the admin,
-- separately from balance -- an intentional, auditable correction
-- rather than an automatic side effect of a balance change.
-- Dedicated audit table, sama gaya seperti balance_adjustments
-- (0004_manual_balance.sql) tapi untuk perubahan total_topup secara
-- eksplisit -- tidak dipaksakan ke balance_adjustments karena tabel itu
-- punya check constraint (amount <> 0) yang secara semantik terikat ke
-- perubahan saldo, bukan koreksi total_topup.
create table if not exists public.total_topup_adjustments (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.users (id) on delete set null,
  user_id uuid not null references public.users (id) on delete cascade,
  old_total_topup bigint not null,
  new_total_topup bigint not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists total_topup_adjustments_user_idx
  on public.total_topup_adjustments (user_id, created_at desc);

alter table public.total_topup_adjustments enable row level security;
-- Sama seperti balance_adjustments -- cuma bisa ditulis lewat RPC
-- security definer di bawah (service_role/definer bypass RLS), tidak ada
-- grant langsung ke authenticated/anon.
revoke all on public.total_topup_adjustments from anon, authenticated;

create or replace function public.admin_set_total_topup(
  p_admin_id uuid,
  p_user_id uuid,
  p_new_total_topup bigint,
  p_note text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.users;
  v_old bigint;
begin
  if p_new_total_topup < 0 then
    raise exception 'invalid_amount';
  end if;

  perform public.assert_not_banned(p_user_id);

  select total_topup into v_old from public.users where id = p_user_id;
  if not found then
    raise exception 'user_not_found';
  end if;

  update public.users
    set total_topup = p_new_total_topup
    where id = p_user_id
    returning * into v_row;

  insert into public.total_topup_adjustments (admin_id, user_id, old_total_topup, new_total_topup, note)
  values (p_admin_id, p_user_id, v_old, p_new_total_topup, p_note);

  return v_row;
end;
$$;

grant execute on function public.admin_set_total_topup(uuid, uuid, bigint, text) to authenticated;
