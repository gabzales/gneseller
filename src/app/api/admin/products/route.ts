import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";

// Lightweight catalog listing (id/name + durations id/label) for admin
// pickers that need to reference a product+duration without pulling in
// the full getAdminProducts() shape (stock counts, provider mapping,
// etc.) -- used by the per-reseller custom price picker.
export async function GET() {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { data, error } = await admin
    .from("products")
    .select("id, name, product_durations ( id, label, price )")
    .order("sort_order");

  if (error) return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 500 });

  return NextResponse.json({
    products: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      durations: (p.product_durations ?? []).map((d: { id: string; label: string; price: number }) => ({
        id: d.id,
        label: d.label,
        price: d.price,
      })),
    })),
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const category = typeof body?.category === "string" ? body.category.trim() : "General";

  if (!name) return NextResponse.json({ error: "missing_name" }, { status: 400 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  let id = slugify(name);
  if (!id) return NextResponse.json({ error: "invalid_name" }, { status: 400 });

  // Avoid clashing with an existing id (product ids are free-text slugs,
  // not auto-increment, so two products named similarly would collide).
  const { data: existing } = await admin.from("products").select("id").eq("id", id).maybeSingle();
  if (existing) id = `${id}-${Date.now().toString(36)}`;

  const { data: countRow } = await admin
    .from("products")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (countRow?.sort_order ?? 0) + 1;

  const { error } = await admin.from("products").insert({
    id,
    name,
    category: category || "General",
    active: false, // starts inactive until admin adds at least one duration/stock
    sort_order: sortOrder,
  });

  if (error) return NextResponse.json({ error: "insert_failed", message: error.message }, { status: 500 });

  return NextResponse.json({ id });
}
