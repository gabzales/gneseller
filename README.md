# GhostSeller — Reseller Panel

UI + backend untuk `ghostseller.my.id`, dibangun dari PRD v2.0
(`gemini-code-*.md`) dan referensi tampilan `ibmseller.wtf` (light theme,
kartu putih, aksen flat violet/coral/mint/peach). Next.js 14 (App Router)
+ Tailwind + Supabase (shared DB dengan `ghostnewera.web.id`).

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`. **Tanpa `.env.local` sama sekali, seluruh
app tetap jalan penuh** — auth, generate key, topup, history — semua
otomatis pakai data mock di `src/lib/mock-data.ts` (mode demo). Ini
disengaja supaya UI selalu bisa direview tanpa perlu project Supabase
lebih dulu.

## Menyambungkan ke Supabase (production)

1. Buat/ pakai project Supabase yang sama dengan `ghostnewera.web.id`.
2. Jalankan **kedua** migration di SQL editor project itu, berurutan:
   - `supabase/migrations/0001_init.sql` — semua tabel, RLS policy, dan
     RPC dasar (`generate_key`, `settle_topup`).
   - `supabase/migrations/0002_production_hardening.sql` — unique
     constraint di `key_string`/`merchant_ref`, tabel + RPC rate limit
     (`check_rate_limit`), RPC `create_pending_topup`, dan versi
     `settle_topup` yang match `merchant_ref` ke baris pending yang sudah
     dibuat `/api/topup/create` (bukan insert baris baru terpisah).
3. Di **Authentication → Providers → Email**, pastikan Email provider
   aktif (default sudah aktif). Lalu di **Authentication → Settings**,
   **matikan "Allow new users to sign up"**. Ini wajib, bukan opsional:
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` ada di bundle JS client (publik by
   design), jadi siapa pun yang tahu itu bisa panggil endpoint signup
   Supabase langsung lewat `curl`/Postman dan bikin akun sendiri,
   melewati approval WhatsApp sama sekali — kalau toggle ini nyala.
   Dengan toggle ini mati, satu-satunya cara akun baru muncul di
   `auth.users` adalah admin yang bikin manual (langkah 6 di bawah).
4. Copy `.env.example` → `.env.local`, isi:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — dari
     Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, jangan pernah expose
     ke client. Dipakai `/api/generate-key` dan `/api/webhooks/topup`
     buat mutasi saldo lewat RPC yang bypass RLS dengan sengaja.
   - `GENSPAY_BASE_URL`, `GENSPAY_API_KEY` — kredensial GensPay kamu
     (lihat bagian Top Up di bawah). GensPay tidak punya mode
     sandbox terpisah seperti Tripay -- test pakai nominal kecil di
     akun production langsung, atau minta akun test ke admin GensPay.
   - `NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER` — nomor WA admin buat tombol
     "Mulai Chat via WhatsApp" di landing page.
5. Restart dev server. Begitu env terisi, middleware otomatis mulai
   nge-guard `/dashboard/*` dan semua page beralih dari mock ke query
   Supabase asli — tidak ada saklar manual yang perlu diubah di kode.
6. **Bikin akun reseller** (setelah mereka chat WA dan disetujui) — dua
   cara, pilih salah satu:
   - **Manual lewat Dashboard**: Supabase Dashboard → **Authentication →
     Users → Add User**, isi email + password, centang **Auto Confirm
     User** (biar gak perlu verifikasi email — tidak relevan di sini
     karena bukan mereka yang daftar sendiri). Trigger
     `handle_new_auth_user()` di `0001_init.sql` otomatis bikin baris
     `public.users` yang matching (balance 0, role `user`) begitu akun
     itu dibuat.
   - **Lewat terminal** (lebih cepat, tanpa buka Dashboard): jalankan
     `node scripts/create-admin.js email@contoh.com password123 "Nama"`.
     Script ini butuh `SUPABASE_SERVICE_ROLE_KEY` di `.env.local`
     (Dashboard → Settings → API → Project API keys → `service_role`,
     **bukan** `anon public`). Meski namanya "create-admin", script ini
     dipakai untuk akun mana pun — kalau reseller biasa, cukup ubah
     `role: "admin"` jadi `role: "user"` di baris upsert dalam skrip,
     atau update manual lewat SQL editor setelah run:
     `update public.users set role = 'user' where email = '...'`.
     Aman dijalankan berkali-kali (email yang sama akan diupdate
     password-nya, bukan gagal/dobel).
   Kirim email + password itu ke reseller lewat chat WhatsApp yang sama.

## Struktur

```
supabase/migrations/0001_init.sql   schema + RLS + RPC (generate_key, settle_topup)

src/middleware.ts                   proteksi /dashboard/* + refresh session

src/lib/supabase/
  client.ts        browser client (dipanggil dari Client Component)
  server.ts         server client, ikut cookie request (Server Component/Route)
  admin.ts           service-role client — HANYA dipakai di src/app/api/**
  config.ts          isSupabaseConfigured — kontrol fallback ke mock

src/lib/data/                        data-access layer: pakai Supabase kalau
  user.ts / products.ts / activity.ts  configured, kalau tidak fallback ke mock-data.ts

src/app/
  page.tsx                 landing page (PRD 3.1) + HowToBecomeReseller carousel
  login/page.tsx            login email/password (akun dibuat admin manual)
  api/
    generate-key/route.ts       cek saldo -> potong -> insert key (atomik, PRD 3.4)
    webhooks/topup/route.ts      webhook QRIS, verifikasi signature, idempotent (PRD 4-5)
    topup/create/route.ts         create transaction GensPay, insert pending topup
    topup/status/route.ts         polling status dari client (QR modal), baca via RLS user
  dashboard/
    layout.tsx              app shell: sidebar (desktop) + bottom nav (mobile)
    page.tsx                 dashboard utama (PRD 3.3)
    generate/                generate keys (PRD 3.4)
    topup/                    top up saldo QRIS (PRD 3.5)
    history/keys/, history/topup/   riwayat (PRD 3.6)
    calendar/                kalender aktivitas (PRD 3.6)
    profile/                  profil + logout (PRD 3.7)

src/components/           komponen UI (Sidebar, BottomNav, cards, forms, dst)
```

## Keamanan (PRD 5, audit pass ke-2)

- **Balance tidak pernah client-writable.** Satu-satunya jalan mengubah
  saldo adalah lewat `generate_key()`, `settle_topup()`, dan
  `create_pending_topup()` — fungsi Postgres `SECURITY DEFINER` yang
  dipanggil dari route handler pakai service-role key, bukan dari
  browser.
- **RLS aktif di semua tabel**, termasuk `rate_limit_hits` yang baru
  (tidak ada grant sama sekali ke `anon`/`authenticated`, cuma bisa
  disentuh service-role lewat RPC `check_rate_limit`). User cuma bisa
  `select` baris miliknya sendiri (`auth.uid() = user_id`); tidak ada
  policy `update`/`insert` buat `reseller_keys` atau `topups` dari sisi
  client sama sekali.
- **Key generation pakai `crypto.randomBytes`**, bukan `Math.random()`
  (yang predictable/low-entropy) — lihat `src/app/api/generate-key/route.ts`.
  `reseller_keys.key_string` sekarang punya unique constraint di DB
  (migration 0002); route-nya retry otomatis kalau collision.
- **Rate limiting** di `/api/generate-key` (20 request/menit/user) dan
  `/api/topup/create` (10/menit/user) lewat RPC `check_rate_limit` —
  fail-open kalau RPC error supaya outage rate-limiter tidak jadi outage
  endpoint, tapi auth/RLS di baliknya tetap jalan.
- **Origin check** (`src/lib/origin-guard.ts`) di kedua endpoint di atas
  sebagai lapisan tambahan di luar `SameSite=Lax` cookie Supabase.
- **Webhook diverifikasi signature** (`X-Genspay-Signature` vs
  `SHA256(rawBody + GENSPAY_API_KEY)` -- plain SHA256, bukan HMAC,
  `timingSafeEqual`) sebelum payload dipercaya, `data.amount` dicocokkan
  ke nominal dari `order_id` kalau field itu ada di payload GensPay
  (menolak `amount_mismatch`), dan `settle_topup()` idempotent lewat
  `provider_ref` — webhook yang di-retry gateway tidak akan pernah
  nge-credit saldo dua kali.
- **`/api/topup/create` sudah diimplementasi penuh** (GensPay
  `/transaction/create`), lihat bagian Top Up di bawah. Nominal divalidasi server-side
  terhadap `TOPUP_PACKAGES` — body request cuma boleh kirim `nominal`,
  bonus/total tidak pernah dipercaya dari client.
- **Security headers** (`next.config.mjs`): CSP, HSTS, X-Frame-Options
  DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- **Login pakai email/password, bukan OAuth** — tidak ada form daftar
  sendiri di app ini sama sekali (`src/components/LoginForm.tsx` cuma
  punya field login). Satu-satunya cara akun baru ada adalah admin bikin
  manual di Supabase Dashboard setelah approval lewat WhatsApp. **Wajib**
  matikan "Allow new users to sign up" di Supabase Auth Settings (lihat
  langkah 3 di bagian Supabase di atas) — kalau lupa, endpoint signup
  Supabase tetap bisa dipanggil langsung dari luar app pakai anon key
  yang publik, dan approval WhatsApp jadi percuma.
- **Pesan error login generik** ("Email atau password salah") — tidak
  membedakan "email tidak terdaftar" vs "password salah", supaya tidak
  bisa dipakai buat enumerasi akun mana yang terdaftar.
- **`npm audit`**: 2 advisory high pada `next`/`postcss`, keduanya hanya
  fixable dengan lompat ke Next.js 16 (breaking, App Router API berubah).
  Project ini sudah di versi terbaru jalur 14.2.x (`14.2.35`). Upgrade ke
  Next 15/16 disarankan sebagai proyek migrasi terpisah yang perlu testing
  penuh, bukan bagian dari audit ini.

### Top Up — sudah tersambung ke GensPay

`src/app/api/topup/create/route.ts`:
1. Validasi `nominal` terhadap `TOPUP_PACKAGES` (`src/lib/mock-data.ts`).
2. POST ke GensPay `/transaction/create` dengan header `X-API-Key`
   (tidak ada signature HMAC per-request di langkah ini, beda dari Tripay),
   body `{ amount, order_id }` -- `order_id` kita pakai format
   `topup:<user_id>:<nominal>:<nonce>` sebagai idempotency key kita sendiri.
3. Insert baris `pending` ke `public.topups` lewat RPC `create_pending_topup`
   supaya langsung muncul di History.
4. Return `qrString` (string QRIS mentah, bukan URL redirect) dari GensPay
   ke client — `TopupForm` merender ini jadi gambar QR di modal
   (`qrcode.react`) dan mulai polling `/api/topup/status` tiap 5 detik
   sampai statusnya `success` (atau webhook menyelesaikannya lebih dulu).

`api/webhooks/topup/route.ts` menerima callback-nya, verifikasi signature,
cocokkan `data.amount` (kalau field itu ada di payload), lalu `settle_topup()`
— yang otomatis nemuin dan nge-settle baris `pending` yang sama lewat
`merchant_ref` (bukan bikin baris baru).

`api/topup/status/route.ts` dipanggil client saat polling -- baca lewat
sesi user sendiri (RLS), bukan service-role, karena cuma perlu baca baris
milik user yang sedang login.

Ganti provider lain (Midtrans/PayDisini)? Cukup ubah `tripaySignature()` +
body request di `create/route.ts`, dan `verifySignature`/field parsing di
`webhooks/topup/route.ts` — RPC `settle_topup`/`create_pending_topup` di
baliknya tidak perlu diubah.

## Responsive

- **< 1024px (mobile):** top bar + kartu saldo + grid layanan 2 kolom +
  bottom nav pill mengambang (Home / Activity / Profile), sama seperti
  referensi `ibmseller.wtf`.
- **≥ 1024px (desktop):** sidebar kiri tetap (semua menu), konten 2 kolom
  (layanan + ringkasan/aktivitas terbaru), header tanpa tombol back.

## Tema

Semua warna lewat CSS variable di `src/app/globals.css` (light theme:
kartu putih, background off-white, aksen violet `#6c5dd3` / coral
`#f16b6f` / mint `#22cd9d` / peach `#f0a172` — dicocokkan ke referensi).
Panel admin dynamic theming (PRD 2) tinggal menulis ulang variabel ini
saat load, tidak perlu sentuh komponen manapun.

## Verifikasi yang sudah dilakukan (audit pass ke-2)

```bash
npm run build     # ✓ compiles, 17 routes, 0 type error
npx tsc --noEmit  # ✓ clean
npx eslint src    # ✓ 0 warning
npm run start     # ✓ halaman 200, /api/generate-key balas 503 yang benar
                   #   tanpa Supabase configured, security headers terpasang
npm audit          # 2 advisory high (next, postcss) -- lihat catatan di
                   #   bagian Keamanan, perlu migrasi major version terpisah
```

Belum dilakukan di sesi ini: load-testing RPC saldo di bawah concurrency
tinggi, test end-to-end ke GensPay sungguhan (butuh kredensial akun
asli -- GensPay tidak punya mode sandbox terpisah), dan klik tombol
WhatsApp sampai benar-benar connect ke app WhatsApp (link `wa.me`-nya
diverifikasi format/encoding-nya benar, tapi app-to-app handoff itu di
luar jangkauan browser headless).

## Checklist sebelum go-live

1. Jalankan `0001_init.sql` **dan** `0002_production_hardening.sql` di
   Supabase SQL editor (urut).
2. Matikan **"Allow new users to sign up"** di Supabase Authentication
   Settings (lihat bagian Keamanan) — kalau ini kelewat, approval lewat
   WhatsApp gak ada gunanya karena orang bisa bikin akun sendiri lewat
   API Supabase langsung.
3. Isi semua env var di `.env.example`, termasuk `GENSPAY_*` dan
   `NEXT_PUBLIC_ADMIN_WHATSAPP_NUMBER` — tanpa `GENSPAY_*`,
   `/api/topup/create` balas `503 payment_gateway_not_configured`.
4. Daftarkan URL webhook GensPay (`https://ghostseller.my.id/api/webhooks/topup`)
   di dashboard GensPay, pastikan `GENSPAY_API_KEY` yang dipakai auth di
   `create/route.ts` sama persis dengan yang divalidasi di
   `webhooks/topup/route.ts` (satu env var yang sama dipakai di kedua
   tempat -- tidak ada key create/webhook terpisah seperti Tripay).
5. Per pemberitahuan resmi GensPay (Agustus 2026): pastikan webhook
   URL ini sudah terdaftar SEBELUM go-live -- merchant tanpa webhook
   yang jalan dilaporkan IP-nya bisa diblokir kalau frontend fallback ke
   polling frekuensi tinggi. `TopupForm` di sini sudah polling dengan
   jeda 5 detik (jauh di bawah batas 30 req/3 menit mereka), tapi
   webhook tetap jalur utama -- polling cuma cadangan UX.
6. Test satu siklus top up penuh (nominal kecil) di akun GensPay
   **production** dulu (tidak ada sandbox terpisah) sebelum kasih akses
   ke reseller sungguhan.
7. Buat minimal satu akun reseller test (langkah 6 di bagian Supabase)
   dan coba login penuh sebelum kasih akses ke reseller sungguhan.

## Deploy

Vercel (`vercel --prod`), domain `ghostseller.my.id`, env vars sama
persis dengan project `ghostnewera.web.id` (shared Supabase project).
Tidak ada OAuth redirect URL yang perlu didaftarkan (login email/password
tidak butuh itu) — cukup pastikan env vars di atas sudah terisi di
Vercel project settings sebelum go-live.
