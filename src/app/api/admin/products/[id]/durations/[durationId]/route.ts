import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; durationId: string }> }
) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id: productId, durationId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string" && body.label.trim()) patch.label = body.label.trim();
  if (Number.isFinite(Number(body.days)) && Number(body.days) > 0) patch.days = Number(body.days);
  if (Number.isFinite(Number(body.price)) && Number(body.price) >= 0) patch.price = Number(body.price);
  if (body.stockMode === "manual" || body.stockMode === "auto") patch.stock_mode = body.stockMode;

  // provider_item_id only makes sense in auto mode -- clear it whenever the
  // duration isn't (or is being switched away from) auto, so a stale
  // mapping can never silently linger and get picked back up later.
  const nextStockMode = (patch.stock_mode as string | undefined) ?? undefined;
  if (typeof body.providerItemId === "string" || body.providerItemId === null) {
    patch.provider_item_id = nextStockMode === "manual" ? null : body.providerItemId || null;
  }
  if (nextStockMode === "manual") patch.provider_item_id = null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error } = await admin
    .from("product_durations")
    .update(patch)
    .eq("product_id", productId)
    .eq("id", durationId);

  if (error) return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; durationId: string }> }
) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id: productId, durationId } = await params;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error } = await admin
    .from("product_durations")
    .delete()
    .eq("product_id", productId)
    .eq("id", durationId);

  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
