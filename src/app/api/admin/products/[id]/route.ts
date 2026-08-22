import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.category === "string" && body.category.trim()) patch.category = body.category.trim();
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.sortOrder === "number") patch.sort_order = body.sortOrder;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error } = await admin.from("products").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  // product_durations has ON DELETE CASCADE from products, and key_stock
  // has ON DELETE CASCADE from product_durations (0003 migration) -- one
  // delete here cleans up durations + manual key pool together.
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
