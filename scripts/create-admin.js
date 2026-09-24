/**
 * Bikin 1 akun admin Ghost Seller lewat terminal, tanpa perlu buka
 * Supabase Dashboard sama sekali.
 *
 * INI SCRIPT SEKALI-JALAN, BUKAN ROUTE API -- sengaja tidak ditaruh di
 * src/app/api/** supaya tidak nyangkut jadi endpoint publik yang lupa
 * dihapus. Jalanin dari terminal server/laptop kamu sendiri, bukan dari
 * browser.
 *
 * Cara pakai:
 *   1. Pastikan .env.local sudah ada NEXT_PUBLIC_SUPABASE_URL dan
 *      SUPABASE_SERVICE_ROLE_KEY (Service Role Key, BUKAN anon key --
 *      ambil dari Supabase Dashboard > Settings > API kalau belum ada).
 *   2. Jalankan:
 *        node scripts/create-admin.js admin@contoh.com password-kamu "Nama Admin"
 *      (password minimal 6 karakter, sesuai aturan default Supabase Auth)
 *   3. Login di /login pakai email + password itu.
 *
 * Aman dijalankan berkali-kali dengan email yang sama -- kalau akunnya
 * sudah ada, script update password & role='admin' alih-alih gagal.
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

async function main() {
  const [, , email, password, ...nameParts] = process.argv;
  const fullName = nameParts.join(" ") || "Admin";

  if (!email || !password) {
    console.error("Pakai: node scripts/create-admin.js <email> <password> [nama]");
    console.error('Contoh: node scripts/create-admin.js admin@ghostseller.my.id "rahasia123" "Admin Ghost"');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password minimal 6 karakter (aturan default Supabase Auth).");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local.\n" +
        "Ambil dari Supabase Dashboard > Settings > API (Service Role Key ada di bagian " +
        '"Project API keys", tulisannya "service_role", BUKAN yang "anon public").'
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Cek dulu apakah user dengan email ini sudah ada -- kalau ada, update
  // password & pastikan role admin, bukan bikin dobel/gagal karena
  // constraint unique email.
  const { data: existingList, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    console.error("Gagal cek user existing:", listError.message);
    process.exit(1);
  }
  const existing = existingList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId;
  if (existing) {
    console.log(`User dengan email ${email} sudah ada, update password...`);
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) {
      console.error("Gagal update password:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
  } else {
    console.log(`Membuat user baru: ${email}...`);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // langsung terverifikasi, tidak perlu klik link email
      user_metadata: { full_name: fullName },
    });
    if (error) {
      console.error("Gagal membuat user:", error.message);
      process.exit(1);
    }
    userId = data.user.id;
  }

  // Trigger di 0001_init.sql (handle_new_auth_user) otomatis membuat baris
  // public.users saat auth.users diisi -- tapi trigger itu tidak selalu
  // langsung selesai kalau dipanggil balik-balik dalam skrip yang sama,
  // jadi upsert manual di sini juga supaya idempotent dan pasti ada,
  // sekaligus set role='admin' yang trigger-nya tidak lakukan (default
  // trigger selalu bikin role='user').
  const { error: upsertError } = await admin
    .from("users")
    .upsert(
      { id: userId, email, full_name: fullName, role: "admin", verified: true },
      { onConflict: "id" }
    );
  if (upsertError) {
    console.error("Gagal set role admin di public.users:", upsertError.message);
    process.exit(1);
  }

  console.log("\n✅ Akun admin siap dipakai.");
  console.log(`   Email: ${email}`);
  console.log(`   Login di: /login`);
}

main();
