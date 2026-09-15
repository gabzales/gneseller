import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getProviderProducts } from "@/lib/provider/vipibmstore";

/**
 * Usage: GET /api/debug/provider-mapping?secret=X&product_id=xxx&duration_id=yyy
 *
 * Read-only diagnostic for "Invalid request" / provider_error saat generate
 * key stock_mode=auto (mis. PATO BLUE, Sep 2026). Tidak memanggil
 * orderProviderKey (POST /v2/orders) -- itu bikin order beneran & motong
 * saldo provider. Ini cuma:
 *   1. Baca provider_item_id yang tersimpan di product_durations kita.
 *   2. Tarik katalog LIVE dari vipibmstore.com (GET /v2/products, aman
 *      dipanggil berkali-kali, ada cache 3 menit di getProviderProducts()
 *      -- pakai fresh=1 kalau mau bypass cache itu).
 *   3. Cocokkan: apakah provider_item_id kita itu BENERAN ada di katalog
 *      mereka saat ini. Kalau tidak ada -- itu penyebab pasti "Invalid
 *      request" (mapping nunjuk ke item yang sudah dihapus/diganti ID-nya
 *      di sisi vipibmstore, atau dari awal salah ketik pas mapping).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debugSecret = (process.env.GENSPAY_DEBUG_SECRET || process.env.SETUP_ADMIN_SECRET || "").trim();
  const provided = searchParams.get("secret");
  if (!debugSecret) {
    return NextResponse.json(
      { error: "not_configured", message: "Isi GENSPAY_DEBUG_SECRET atau SETUP_ADMIN_SECRET di Vercel, redeploy, baru buka URL ini lagi." },
      { status: 503 }
    );
  }
  if (!provided || provided !== debugSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const productId = searchParams.get("product_id");
  const durationId = searchParams.get("duration_id");
  const fresh = searchParams.get("fresh") === "1";

  const admin = createAdminSupabase();
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 });
  }

  // Kalau product_id/duration_id gak dikasih, tampilkan SEMUA duration
  // stock_mode=auto sekaligus -- lebih cepat buat nemuin yang lain juga
  // salah mapping tanpa harus tes 1-1.
  let query = admin
    .from("product_durations")
    .select("id, label, price, provider_item_id, product_id, products(name)")
    .eq("stock_mode", "auto");
  if (productId) query = query.eq("product_id", productId);
  if (durationId) query = query.eq("id", durationId);

  const { data: durations, error: durationsError } = await query;
  if (durationsError) {
    return NextResponse.json({ error: "query_failed", message: durationsError.message }, { status: 500 });
  }
  if (!durations || durations.length === 0) {
    return NextResponse.json({
      error: "no_auto_durations_found",
      message: productId || durationId
        ? "Gak ada duration stock_mode=auto yang cocok sama product_id/duration_id itu."
        : "Gak ada satupun duration stock_mode=auto di database ini.",
    });
  }

  const catalog = await getProviderProducts({ fresh });
  if (!catalog.success) {
    return NextResponse.json({
      error: "provider_catalog_unreachable",
      message: "Gagal narik katalog vipibmstore.com -- ini sendiri bisa jadi penyebab 'Invalid request' (API Key/Secret Reseller API salah/expired).",
      providerError: catalog,
    });
  }

  // FIX: bandingin sebagai string, dua-duanya. Kalau API vipibmstore
  // balikin id sebagai JSON number (55, bukan "55") sementara kolom kita
  // provider_item_id itu text ("55"), Set.has() versi lama di sini akan
  // SELALU false walau nilainya sama -- itu yang bikin hasil awal nunjukin
  // 100% "MAPPING RUSAK" utk 117/117 item sekaligus, jelas bukan realita.
  const catalogIds = new Set(catalog.data.map((p) => String(p.id)));

  const results = durations.map((d) => {
    const mappedId = d.provider_item_id || "";
    const foundInCatalog = mappedId ? catalogIds.has(String(mappedId)) : false;
    return {
      product: (d.products as unknown as { name?: string } | null)?.name ?? d.product_id,
      duration: d.label,
      ourPrice: d.price,
      provider_item_id: mappedId || "(KOSONG -- belum di-mapping sama sekali)",
      foundInProviderCatalogRightNow: foundInCatalog,
      verdict: !mappedId
        ? "BELUM DI-MAPPING -- ini penyebab pasti kalau duration ini yang error."
        : foundInCatalog
          ? "Mapping OK, item ini ada di katalog vipibmstore.com saat ini."
          : "MAPPING RUSAK -- provider_item_id ini TIDAK ADA di katalog vipibmstore.com sekarang. Kemungkinan item-nya sudah dihapus/diganti ID di sisi mereka, atau salah ketik pas mapping dulu. Ini penyebab paling mungkin dari 'Invalid request'.",
    };
  });

  // Sample mentah 3 item pertama dari katalog vipibmstore.com apa adanya
  // (termasuk typeof id-nya) -- biar keliatan jelas ini number atau
  // string di sisi MEREKA, gak perlu nebak lagi. Kalau typeof "number",
  // ada kemungkinan orderProviderKey() (yang beneran dipanggil pas
  // Generate Key, bukan cuma debug ini) juga kena masalah sama: dia
  // kirim product_item_id apa adanya dari kolom text kita (jadi string)
  // ke body JSON, dan kalau vipibmstore.com validasi strict tipe data,
  // itu bisa jadi penyebab ASLI "Invalid request" di produksi.
  const rawSample = catalog.data.slice(0, 3).map((p) => ({ id: p.id, idType: typeof p.id }));

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    providerCatalogSize: catalog.data.length,
    rawCatalogIdSample: rawSample,
    results,
  });
}
