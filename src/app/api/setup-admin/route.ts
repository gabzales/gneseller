import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Bikin/update 1 akun admin lewat browser, TANPA perlu setup lokal
 * (node_modules, .env.local) -- cukup buka URL ini di production yang
 * env var-nya sudah terisi di Vercel.
 *
 * ⚠️ HAPUS FILE INI (atau minimal ganti/hapus SETUP_ADMIN_SECRET) setelah
 * dipakai. Endpoint ini sengaja dibuat untuk kemudahan setup SEKALI di
 * awal, bukan untuk dibiarkan aktif selamanya -- siapa pun yang tau
 * secret-nya bisa bikin akun admin baru kapan saja selama file ini masih
 * ada dan ter-deploy.
 *
 * Cara pakai: buka di browser (GET request biasa, tidak perlu Postman/curl)
 *   https://domainkamu.com/api/setup-admin?secret=SETUP_ADMIN_SECRET&email=admin@contoh.com&password=passwordkamu&name=Nama
 *
 * SETUP_ADMIN_SECRET diisi sendiri di environment variable Vercel --
 * bukan hardcoded di sini, supaya tidak ada siapa pun (termasuk yang baca
 * source code ini di GitHub publik) yang bisa langsung pakai endpoint
 * ini tanpa tahu secret yang kamu set sendiri.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const setupSecret = process.env.SETUP_ADMIN_SECRET;
  const providedSecret = searchParams.get("secret");
  if (!setupSecret) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "SETUP_ADMIN_SECRET belum diisi di environment variable Vercel. Isi dulu (bebas, string rahasia apa saja), redeploy, baru buka URL ini lagi.",
      },
      { status: 503 }
    );
  }
  if (!providedSecret || providedSecret !== setupSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = searchParams.get("email");
  const password = searchParams.get("password");
  const name = searchParams.get("name") || "Admin";

  if (!email || !password) {
    return NextResponse.json(
      { error: "missing_params", message: "Wajib isi ?email=...&password=... di URL." },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "password_too_short", message: "Password minimal 6 karakter (aturan Supabase Auth)." },
      { status: 400 }
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error: "supabase_not_configured",
        message: "NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diisi.",
      },
      { status: 503 }
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: existingList, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw listError;

    const existing = existingList.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    let userId: string;
    let action: "created" | "updated";

    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, { password });
      if (error) throw error;
      userId = data.user.id;
      action = "updated";
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) throw error;
      userId = data.user.id;
      action = "created";
    }

    const { error: upsertError } = await admin
      .from("users")
      .upsert({ id: userId, email, full_name: name, role: "admin", verified: true }, { onConflict: "id" });
    if (upsertError) throw upsertError;

    return NextResponse.json({
      ok: true,
      action,
      email,
      message: `Akun admin siap dipakai. Login di /login pakai email ${email} dan password yang barusan kamu isi. INGAT: hapus endpoint ini (atau ganti SETUP_ADMIN_SECRET) setelah ini.`,
    });
  } catch (err) {
    // FIX: Supabase client sering nge-throw objek error yang PUNYA field
    // `message` tapi BUKAN instance dari class Error bawaan JS -- kondisi
    // lama (err instanceof Error) gagal match untuk kasus itu dan selalu
    // jatuh ke fallback generik "Gagal membuat akun.", menyembunyikan
    // pesan asli (mis. "duplicate key", "permission denied", RLS error,
    // dll) yang justru paling penting buat diagnosis. Sekarang dicoba
    // ambil .message dari bentuk objek apa pun sebelum fallback ke string.
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal membuat akun (penyebab tidak diketahui, cek Vercel logs).";
    console.error("[setup-admin] error:", err);
    return NextResponse.json({ error: "failed", message }, { status: 500 });
  }
}
