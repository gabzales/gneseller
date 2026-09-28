import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { invalidateStenlyConfigCache } from "@/lib/provider/stenly";

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

  const [{ data: stenlyRow }, { data: gatewayRow }] = await Promise.all([
    admin.from("app_settings").select("value").eq("key", "stenly").maybeSingle(),
    admin.from("app_settings").select("value").eq("key", "payment_gateway").maybeSingle(),
  ]);
  const value = (stenlyRow?.value ?? {}) as { apiKey?: string; webhookSecret?: string; baseUrl?: string };
  const active = (gatewayRow?.value as { active?: string } | null)?.active === "stenly" ? "stenly" : "genspay";

  return NextResponse.json({
    baseUrl: value.baseUrl || "https://stenly.id/api/v1",
    apiKeyMasked: mask(value.apiKey || ""),
    webhookSecretMasked: mask(value.webhookSecret || ""),
    configured: Boolean(value.apiKey && value.webhookSecret),
    activeGateway: active,
  });
}

export async function PUT(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data: existing } = await admin.from("app_settings").select("value").eq("key", "stenly").maybeSingle();
  const current = (existing?.value ?? {}) as { apiKey?: string; webhookSecret?: string; baseUrl?: string };

  // Blank field in the request means "leave unchanged" -- same reasoning as
  // the genspay settings route: GET only ever returns masked values.
  const next = {
    baseUrl:
      typeof body?.baseUrl === "string" && body.baseUrl.trim() ? body.baseUrl.trim() : current.baseUrl || "https://stenly.id/api/v1",
    apiKey: typeof body?.apiKey === "string" && body.apiKey.trim() ? body.apiKey.trim() : current.apiKey || "",
    webhookSecret:
      typeof body?.webhookSecret === "string" && body.webhookSecret.trim()
        ? body.webhookSecret.trim()
        : current.webhookSecret || "",
  };

  const { error } = await admin
    .from("app_settings")
    .upsert({ key: "stenly", value: next, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });

  // activeGateway is optional in the PUT body -- lets the toggle be saved
  // from the same form without a second round-trip.
  if (body?.activeGateway === "genspay" || body?.activeGateway === "stenly") {
    const { error: gwError } = await admin
      .from("app_settings")
      .upsert({ key: "payment_gateway", value: { active: body.activeGateway }, updated_at: new Date().toISOString() });
    if (gwError) return NextResponse.json({ error: "save_failed", message: gwError.message }, { status: 500 });
  }

  invalidateStenlyConfigCache();
  return NextResponse.json({ ok: true });
}
