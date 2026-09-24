import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { invalidateGenspayConfigCache } from "@/lib/provider/genspay";

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

  const { data } = await admin.from("app_settings").select("value").eq("key", "genspay").maybeSingle();
  const value = (data?.value ?? {}) as { apiKey?: string; baseUrl?: string };

  return NextResponse.json({
    baseUrl: value.baseUrl || "https://genspay.my.id/api/v1",
    apiKeyMasked: mask(value.apiKey || ""),
    configured: Boolean(value.apiKey),
  });
}

export async function PUT(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data: existing } = await admin.from("app_settings").select("value").eq("key", "genspay").maybeSingle();
  const current = (existing?.value ?? {}) as { apiKey?: string; baseUrl?: string };

  // Blank apiKey in the request means "leave unchanged" -- same reasoning
  // as src/app/api/admin/settings/provider/route.ts: GET only ever
  // returns a masked value, so the form can't round-trip the real
  // secret back unless the admin is deliberately replacing it.
  const next = {
    baseUrl:
      typeof body?.baseUrl === "string" && body.baseUrl.trim()
        ? body.baseUrl.trim()
        : current.baseUrl || "https://genspay.my.id/api/v1",
    apiKey: typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : current.apiKey || "",
  };

  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "genspay", value: next, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });

  invalidateGenspayConfigCache();
  return NextResponse.json({ ok: true });
}
