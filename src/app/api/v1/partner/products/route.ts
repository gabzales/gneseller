import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPartnerApiConfig, isValidPartnerApiKey } from "@/lib/provider/partner-auth";

// GET /api/v1/partner/products
// Header wajib: X-API-Key
//
// Dipakai sekali-sekali oleh admin RYAN NEW ERA (bukan tiap checkout)
// buat lihat product id + duration id di sisi GhostSeller, supaya bisa
// diisi ke mapping provider_item_id / provider_duration_id per varian
// di panel admin RYAN NEW ERA. Makanya di sini TIDAK perlu rate limit
// seketat /generate-key.
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const { apiKey } = await getPartnerApiConfig();
  const headerKey = request.headers.get("x-api-key");
  if (!apiKey || !isValidPartnerApiKey(headerKey, apiKey)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  const { data: products, error } = await admin
    .from("products")
    .select("id, name, category, active, product_durations(id, label, days, price)")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: products || [] });
}
