import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

function mask(secret: string) {
  if (!secret) return "";
  if (secret.length <= 6) return "*".repeat(secret.length);
  return `${secret.slice(0, 4)}${"*".repeat(Math.max(secret.length - 8, 4))}${secret.slice(-4)}`;
}

export async function GET() {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data } = await admin.from("app_settings").select("value").eq("key", "partner_api").maybeSingle();
  const value = (data?.value ?? {}) as { apiKey?: string; resellerId?: string };

  // Resolve id -> email buat ditampilin di form (admin gak ngapalin UUID,
  // yang keliatan di halaman Kelola Reseller cuma nama/email).
  let resellerEmail = "";
  if (value.resellerId) {
    const { data: reseller } = await admin.from("users").select("email").eq("id", value.resellerId).maybeSingle();
    resellerEmail = reseller?.email || "";
  }

  return NextResponse.json({
    apiKeyMasked: mask(value.apiKey || ""),
    resellerEmail,
    configured: Boolean(value.apiKey && value.resellerId),
  });
}

// PUT { resellerEmail, regenerate?: boolean }
// apiKey TIDAK bisa diisi manual dari body -- selalu di-generate server
// side saat pertama kali diaktifkan atau saat regenerate=true, supaya
// tidak ada godaan admin pakai key yang gampang ditebak.
//
// Dulu field ini namanya resellerId dan admin harus paste UUID mentah --
// diganti ke email karena satu-satunya identitas yang keliatan di halaman
// Kelola Reseller memang email/nama, bukan UUID. UUID tetap yang dipakai
// & disimpan di app_settings, cuma sekarang di-resolve dari email di sini.
export async function PUT(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const email = typeof body?.resellerEmail === "string" ? body.resellerEmail.trim().toLowerCase() : "";
  if (!email) {
    return NextResponse.json({ error: "missing_reseller_email", message: "Email reseller (akun partner) wajib diisi." }, { status: 400 });
  }

  const { data: reseller } = await admin.from("users").select("id").ilike("email", email).eq("role", "user").maybeSingle();
  if (!reseller) {
    return NextResponse.json({ error: "reseller_not_found", message: "Gak ketemu akun reseller dengan email itu -- cek lagi di Kelola Reseller, harus persis sama." }, { status: 404 });
  }

  const { data: existing } = await admin.from("app_settings").select("value").eq("key", "partner_api").maybeSingle();
  const current = (existing?.value ?? {}) as { apiKey?: string; resellerId?: string };

  const shouldGenerate = Boolean(body.regenerate) || !current.apiKey;
  const nextApiKey = shouldGenerate ? `gs_partner_${randomBytes(24).toString("hex")}` : current.apiKey || "";

  const next = { apiKey: nextApiKey, resellerId: reseller.id };

  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "partner_api", value: next, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });

  // apiKey mentah HANYA dikembalikan tepat saat baru di-generate/diganti --
  // setelah ini GET selalu masked, sama seperti pola genspay.
  return NextResponse.json({ ok: true, apiKey: shouldGenerate ? nextApiKey : undefined });
}
