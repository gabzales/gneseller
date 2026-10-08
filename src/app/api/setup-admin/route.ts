import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

/**
 * Setup admin PERTAMA lewat browser: buka /setup-admin, isi kode rahasia
 * (env SETUP_ADMIN_SECRET di Vercel) + email + password.
 *
 * Pengaman:
 *  - POST saja (password tidak pernah masuk URL/log).
 *  - Mati total kalau SETUP_ADMIN_SECRET tidak diisi.
 *  - Perbandingan secret constant-time + rate limit 5x/10 menit per IP.
 *  - HANYA jalan selama BELUM ada admin sama sekali. Setelah admin pertama
 *    jadi, endpoint ini menolak semua request (reset password -> pakai
 *    `node scripts/create-admin.js`).
 *  Tetap disarankan: kosongkan SETUP_ADMIN_SECRET di Vercel setelah selesai.
 */
const noStore = { "Cache-Control": "no-store" };

function safeEq(a: string, b: string) {
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(a), h(b));
}

export async function POST(request: Request) {
  const setupSecret = process.env.SETUP_ADMIN_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!setupSecret) {
    return NextResponse.json(
      { error: "not_configured", message: "SETUP_ADMIN_SECRET belum diisi di environment Vercel (isi string rahasia bebas, lalu redeploy)." },
      { status: 503, headers: noStore }
    );
  }
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "supabase_not_configured", message: "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi." },
      { status: 503, headers: noStore }
    );
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
  if (!(await checkRateLimit(admin, `setup-admin:${ip}`, { maxHits: 5, windowSeconds: 600 }))) {
    return NextResponse.json({ error: "rate_limited", message: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." }, { status: 429, headers: noStore });
  }

  const body = await request.json().catch(() => ({}));
  const secret = typeof body?.secret === "string" ? body.secret : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "Admin";

  if (!(await verifyTurnstile(body?.captchaToken, ip))) {
    return NextResponse.json({ error: "captcha_failed", message: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." }, { status: 400, headers: noStore });
  }
  if (!secret || !safeEq(secret, setupSecret)) {
    return NextResponse.json({ error: "unauthorized", message: "Kode rahasia salah." }, { status: 401, headers: noStore });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "bad_email", message: "Email tidak valid." }, { status: 400, headers: noStore });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password_too_short", message: "Password minimal 8 karakter." }, { status: 400, headers: noStore });
  }

  try {
    // Satu kali saja: kalau sudah ada admin, tolak.
    const { count, error: countError } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countError) throw countError;
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "already_setup", message: "Admin sudah ada. Setup lewat web ditutup. Untuk reset password pakai: node scripts/create-admin.js" },
        { status: 409, headers: noStore }
      );
    }

    const { data: existingList, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const existing = existingList.users.find((u) => u.email?.toLowerCase() === email);

    let userId: string;
    if (existing) {
      const { data, error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (error) throw error;
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error) throw error;
      userId = data.user.id;
    }

    const { error: upsertError } = await admin
      .from("users")
      .upsert({ id: userId, email, full_name: name, role: "admin", verified: true }, { onConflict: "id" });
    if (upsertError) throw upsertError;

    return NextResponse.json(
      { ok: true, message: `Admin ${email} siap. Silakan login di /login. Setelah ini kosongkan SETUP_ADMIN_SECRET di Vercel.` },
      { headers: noStore }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Gagal membuat admin (cek log Vercel).";
    console.error("[setup-admin] error:", err);
    return NextResponse.json({ error: "failed", message }, { status: 500, headers: noStore });
  }
}
