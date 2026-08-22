import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("custom_prices")
    .select("product_id, duration_id, price, product_durations ( label, price ), products ( name )")
    .eq("user_id", id);

  if (error) return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 500 });

  type Row = {
    product_id: string;
    duration_id: string;
    price: number;
    products: { name: string } | { name: string }[] | null;
    product_durations: { label: string; price: number } | { label: string; price: number }[] | null;
  };

  return NextResponse.json({
    prices: ((data ?? []) as Row[]).map((r) => {
      const product = Array.isArray(r.products) ? r.products[0] : r.products;
      const duration = Array.isArray(r.product_durations) ? r.product_durations[0] : r.product_durations;
      return {
        productId: r.product_id,
        durationId: r.duration_id,
        price: r.price,
        productName: product?.name ?? r.product_id,
        durationLabel: duration?.label ?? r.duration_id,
        defaultPrice: duration?.price ?? null,
      };
    }),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const durationId = typeof body?.durationId === "string" ? body.durationId : "";
  const price = Math.trunc(Number(body?.price));

  if (!productId || !durationId) {
    return NextResponse.json({ error: "missing_fields", message: "Pilih produk & durasi dulu." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "invalid_price", message: "Harga tidak valid." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error } = await admin
    .from("custom_prices")
    .upsert(
      { user_id: id, product_id: productId, duration_id: durationId, price },
      { onConflict: "user_id,product_id,duration_id" }
    );

  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const durationId = typeof body?.durationId === "string" ? body.durationId : "";

  if (!productId || !durationId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { error } = await admin
    .from("custom_prices")
    .delete()
    .eq("user_id", id)
    .eq("product_id", productId)
    .eq("duration_id", durationId);

  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
