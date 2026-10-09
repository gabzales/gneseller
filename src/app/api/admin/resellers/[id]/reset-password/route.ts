import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

// POST /api/admin/resellers/[id]/reset-password
// Body: { newPassword }
// Admin menyetel password baru untuk reseller (mis. reseller lupa password).
// Password tidak pernah dicatat di log; kasih tahu reseller lewat WA lalu
// minta dia menggantinya sendiri dari halaman Profil.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await getAdminUser();
  if (!adminUser) return NextResponse.json({ error: "forbidden" }, { status: 403, headers: noStore });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403, headers: noStore });

  const { id: targetId } = await params;
  const body = await request.json().catch(() => ({}));
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 8 || newPassword.length > 72) {
    return NextResponse.json({ error: "bad_password", message: "Password baru 8-72 karakter." }, { status: 400, headers: noStore });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500, headers: noStore });

  const allowed = await checkRateLimit(admin, `admin-reset-password:${adminUser.id}`, { maxHits: 20, windowSeconds: 60 });
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited", message: "Terlalu banyak percobaan, coba lagi sebentar." }, { status: 429, headers: noStore });
  }

  const { data: target } = await admin.from("users").select("id, role").eq("id", targetId).maybeSingle();
  if (!target) return NextResponse.json({ error: "user_not_found", message: "Reseller tidak ditemukan." }, { status: 404, headers: noStore });
  // Akun admin lain tidak boleh direset dari sini (cegah admin saling ambil alih).
  if (target.role === "admin" && target.id !== adminUser.id) {
    return NextResponse.json({ error: "forbidden_target", message: "Akun admin tidak bisa direset dari sini." }, { status: 403, headers: noStore });
  }

  const { error } = await admin.auth.admin.updateUserById(targetId, { password: newPassword });
  if (error) {
    console.error("[admin/reset-password] failed:", error.message);
    return NextResponse.json({ error: "update_failed", message: "Gagal mengganti password." }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ ok: true, message: "Password diganti." }, { headers: noStore });
}
