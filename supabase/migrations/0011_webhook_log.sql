-- FEATURE: persistent webhook call log. Sampai sekarang, satu-satunya
-- cara tahu apakah GensPay BENERAN memanggil /api/webhooks/topup (dan
-- kenapa gagal kalau gagal) adalah menggali Vercel Runtime Logs secara
-- manual -- yang sifatnya sementara/ephemeral dan gampang kelewat kalau
-- tidak dicek persis pas kejadian. Tabel ini menyimpan SETIAP percobaan
-- webhook (masuk atau tidak signature-nya, ketemu row pending atau
-- tidak, berhasil settle atau tidak) secara permanen, supaya bisa dicek
-- kapan saja lewat query biasa -- termasuk untuk membedakan "GensPay
-- tidak pernah memanggil sama sekali" vs "memanggil tapi ditolak" vs
-- "berhasil diproses tapi ada masalah lain".
create table if not exists public.webhook_log (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'genspay',
  result text not null, -- 'signature_invalid' | 'bad_payload' | 'ignored_event' | 'no_pending_row' | 'settled' | 'amount_mismatch' | 'error'
  order_id text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists webhook_log_created_idx on public.webhook_log (created_at desc);
create index if not exists webhook_log_order_idx on public.webhook_log (order_id);

alter table public.webhook_log enable row level security;
-- Cuma bisa ditulis lewat service-role client (webhook route pakai
-- createAdminSupabase(), bypass RLS) -- tidak ada akses langsung dari
-- anon/authenticated, sama seperti tabel internal lain di project ini.
revoke all on public.webhook_log from anon, authenticated;
