import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id: productId } = await params;
  const body = await request.json().catch(() => null);

  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const days = Number(body?.days);
  const price = Number(body?.price);
  const stockMode = body?.stockMode === "auto" ? "auto" : "manual";
  const providerItemId = typeof body?.providerItemId === "string" && body.providerItemId ? body.providerItemId : null;

  if (!label || !Number.isFinite(days) || days <= 0 || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const durationId = `${days}d-${Date.now().toString(36)}`;

  const { error } = await admin.from("product_durations").insert({
    id: durationId,
    product_id: productId,
    label,
    days,
    price,
    stock_mode: stockMode,
    provider_item_id: stockMode === "auto" ? providerItemId : null,
  });

  if (error) return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ id: durationId });
}
