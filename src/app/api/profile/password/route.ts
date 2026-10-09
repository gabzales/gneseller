import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

// POST /api/profile/password
// Body: { currentPassword, newPassword, captchaToken? }
// User yang sedang login mengganti password-nya sendiri. Password lama
// diverifikasi ulang (bukan cuma percaya cookie sesi), jadi sesi yang
// tercuri tidak otomatis bisa mengambil alih akun.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "bad_origin" }, { status: 403, headers: noStore });
  }
  const supabase = await createServerSupabase();
  if (!supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "supabase_not_configured", message: "Backend belum terhubung." }, { status: 503, headers: noStore });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500, headers: noStore });

  const allowed = await checkRateLimit(admin, `change-password:${user.id}`, { maxHits: 5, windowSeconds: 600 });
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited", message: "Terlalu banyak percobaan. Coba lagi 10 menit lagi." }, { status: 429, headers: noStore });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const captchaToken = typeof body?.captchaToken === "string" && body.captchaToken ? body.captchaToken : undefined;

  if (!currentPassword) {
    return NextResponse.json({ error: "missing_current", message: "Isi password lama." }, { status: 400, headers: noStore });
  }
  if (newPassword.length < 8 || newPassword.length > 72) {
    return NextResponse.json({ error: "bad_password", message: "Password baru 8-72 karakter." }, { status: 400, headers: noStore });
  }
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "same_password", message: "Password baru harus berbeda dari yang lama." }, { status: 400, headers: noStore });
  }

  // Verifikasi password lama dengan klien terpisah (tanpa menyimpan sesi,
  // tidak mengubah cookie milik user).
  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (verifyError) {
    const captcha = /captcha/i.test(verifyError.message);
    return NextResponse.json(
      { error: captcha ? "captcha_failed" : "wrong_current", message: captcha ? "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." : "Password lama salah." },
      { status: captcha ? 400 : 403, headers: noStore }
    );
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) {
    console.error("[profile/password] update failed:", error.message);
    return NextResponse.json({ error: "update_failed", message: "Gagal mengganti password. Coba lagi." }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ ok: true, message: "Password berhasil diganti." }, { headers: noStore });
}
