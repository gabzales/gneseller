import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; durationId: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id, durationId } = await params;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("price_tiers")
    .select("id, min_total_topup, price")
    .eq("product_id", id)
    .eq("duration_id", durationId)
    .order("min_total_topup");

  if (error) return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 500 });

  return NextResponse.json({
    tiers: (data ?? []).map((t) => ({ id: t.id, minTotalTopup: t.min_total_topup, price: t.price })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; durationId: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id, durationId } = await params;
  const body = await request.json().catch(() => null);
  const minTotalTopup = Math.trunc(Number(body?.minTotalTopup));
  const price = Math.trunc(Number(body?.price));

  if (!Number.isFinite(minTotalTopup) || minTotalTopup < 0) {
    return NextResponse.json({ error: "invalid_min", message: "Minimal top up tidak valid." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "invalid_price", message: "Harga tidak valid." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  // Upsert on the (product_id, duration_id, min_total_topup) unique
  // constraint so re-saving the same threshold just updates the price
  // instead of erroring on a duplicate.
  const { error } = await admin
    .from("price_tiers")
    .upsert(
      { product_id: id, duration_id: durationId, min_total_topup: minTotalTopup, price },
      { onConflict: "product_id,duration_id,min_total_topup" }
    );

  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
