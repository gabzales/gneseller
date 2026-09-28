import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; durationId: string; tierId: string }> }
) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id, durationId, tierId } = await params;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error } = await admin
    .from("price_tiers")
    .delete()
    .eq("id", tierId)
    .eq("product_id", id)
    .eq("duration_id", durationId);

  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
