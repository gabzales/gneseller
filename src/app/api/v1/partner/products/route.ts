import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPartnerApiConfig, isValidPartnerApiKey } from "@/lib/provider/partner-auth";

// FIX (Sep 2026): route GET ini gampang kena "static caching" default
// Next.js App Router -- kalau itu kejadian, hasil query app_settings di
// getPartnerApiConfig() bisa nyangkut di HASIL PERTAMA yang pernah
// ke-cache selamanya, walau baris di database sudah diupdate berkali-kali
// setelahnya. force-dynamic mastiin route ini SELALU jalan ulang dari
// nol tiap request, termasuk fetch internal yang dipakai supabase-js
// di bawahnya -- tidak ada cache sama sekali.
export const dynamic = 'force-dynamic';

// GET /api/v1/partner/products
// Header wajib: X-API-Key
//
// Dipakai admin RYAN NEW ERA buat lihat product id + duration id di sisi
// GhostSeller (buat mapping provider_item_id / provider_duration_id per
// varian), TAPI juga dipakai toko client buat nampilin harga ke user
// mereka -- jadi `price` di response ini WAJIB harga efektif reseller
// partner (custom_prices / price_tiers berdasarkan total_topup), bukan
// cuma harga katalog default. Kalau cuma pakai product_durations.price
// mentah, harga yang keliatan di toko client tidak akan pernah ikut
// turun walau reseller partner sudah naik tier -- itu bug yang sempat
// kejadian (lihat riwayat chat).
//
// FIX (Sep 2026): tambahkan effective_price (dihitung via RPC
// effective_key_price yang sama dipakai generate_key/generate_key_manual)
// di samping base_price (harga katalog asli, buat referensi admin kalau
// masih perlu bandingkan). Makanya di sini TIDAK perlu rate limit
// seketat /generate-key -- tapi tetap ada N RPC call tambahan per
// durasi, jadi endpoint ini tetap sebaiknya tidak dipanggil tiap
// page-load, cuma saat setup mapping / refresh harga.
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const { apiKey, resellerId } = await getPartnerApiConfig();
  const headerKey = request.headers.get("x-api-key")?.trim() || null;
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

  // Tanpa resellerId (belum diset di app_settings/env), tidak ada akun
  // yang jadi patokan tier/custom price -- kembalikan base price apa
  // adanya (mundur ke perilaku lama) daripada nge-500 semua request.
  if (!resellerId) {
    const fallback = (products || []).map((p) => ({
      ...p,
      product_durations: (p.product_durations || []).map((d: { id: string; label: string; days: number; price: number }) => ({
        ...d,
        base_price: d.price,
        price: d.price,
      })),
    }));
    return NextResponse.json({ data: fallback });
  }

  const withEffectivePrices = await Promise.all(
    (products || []).map(async (p) => {
      const durations = await Promise.all(
        (p.product_durations || []).map(async (d: { id: string; label: string; days: number; price: number }) => {
          const { data: effectivePrice, error: priceError } = await admin.rpc("effective_key_price", {
            p_user_id: resellerId,
            p_product_id: p.id,
            p_duration_id: d.id,
            p_default_price: d.price,
          });
          return {
            ...d,
            base_price: d.price,
            // Kalau RPC gagal (harusnya tidak, tapi jaga-jaga), mundur ke
            // base price daripada gagal seluruh response.
            price: !priceError && typeof effectivePrice === "number" ? effectivePrice : d.price,
          };
        })
      );
      return { ...p, product_durations: durations };
    })
  );

  return NextResponse.json({ data: withEffectivePrices });
}
