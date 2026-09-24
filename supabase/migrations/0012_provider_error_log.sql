-- provider_error_log — catatan tiap kali order ke provider upstream
-- (vipibmstore.com) gagal saat generate-key mode auto (mis. "Insufficient
-- balance", "Invalid request", dll). Sebelumnya cuma console.error() yang
-- ilang begitu request selesai (Vercel serverless) -- gak ada cara buat
-- lihat riwayat/pola tanpa buka Vercel Runtime Logs manual. Dipakai oleh
-- halaman /dashboard/admin/provider-debug biar owner bisa lihat sendiri
-- tanpa perlu ngerti log server.
create table if not exists public.provider_error_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references public.users(id) on delete set null,
  product_id text,
  duration_id text,
  provider_item_id text,
  error_message text not null
);

create index if not exists provider_error_log_created_at_idx on public.provider_error_log (created_at desc);

alter table public.provider_error_log enable row level security;
revoke all on public.provider_error_log from anon, authenticated;
-- service-role only (dibaca/ditulis lewat createAdminSupabase(), sama pola
-- dengan key_stock/app_settings di 0003_admin_provider.sql)
