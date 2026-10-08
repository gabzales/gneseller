# Catatan perubahan (keamanan + hemat Vercel)

## ryan & gne (Express/EJS)
- server.js: `toPublicProduct()` — objek produk yang masuk ke template (/ , /produk, /buy/:id) tidak lagi membawa `keys` (stok license key) maupun `resellerItemId`; hanya `keyCount`, `taggedKeyCounts`, `genericKeyCount`. Template home/produk/buy diubah memakai angka itu.
- Semua `/debug/*` dan `/*-setup`: perbandingan secret timing-safe, boleh via header `x-debug-secret`.
- gne: stockCount Infinity -> 999999 (Infinity jadi null di JSON, produk unlimited tampil "Habis").

## ryan saja (hemat Vercel gratisan)
- Blokir bot/scanner (wp-*, .env, .git, *.zip, *.php, backup, admin.html, dst.) di vercel.json (404 di edge, function tidak jalan) + middleware paling awal di server.js.
- /api/banners, /api/products, /api/stats, /api/testimonials: Cache-Control s-maxage=60 (CDN) + readSmart bukan readFresh (/api/banners dulu baca+tulis DB tiap request).

## gneseller (Next.js)
- Migrasi baru supabase/migrations/0013_lock_down_rpc_and_columns.sql: REVOKE EXECUTE fungsi SECURITY DEFINER dari anon/authenticated (celah cetak saldo/ambil key lewat supabase.rpc dari browser). JALANKAN di Supabase SQL editor.
- Debug/setup-admin: secret timing-safe, no-store, tanpa stack trace; mask secret lebih ketat; guard admin di halaman /dashboard/admin/*; no-store pada respons key.
- Belum dikompilasi (npm diblokir di sandbox): jalankan `npm i && npx next build` sebelum deploy.

## Tindakan manual
1. Ganti (rotate) SETUP_SECRET / GENSPAY_DEBUG_SECRET, key provider, genspay, stenly, service-role Supabase, SESSION secret — source sudah dilihat orang lain.
2. Cek transaksi/saldo janggal (balance_adjustments, topups, reseller_keys vs key_stock).
3. Hapus file sisa Next.js (src/, next.config.mjs, dll) dari repo ryan bila tidak dipakai.
