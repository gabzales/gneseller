import { createAdminSupabase } from "@/lib/supabase/admin";
import { getProviderProducts, getProviderBalance } from "@/lib/provider/vipibmstore";

export type MappingResult = {
  product: string;
  duration: string;
  ourPrice: number;
  provider_item_id: string;
  foundInProviderCatalogRightNow: boolean;
  verdict: string;
};

export type ProviderHealthReport = {
  checkedAt: string;
  balance: { ok: true; amount: number } | { ok: false; message: string };
  catalog: { ok: true; size: number } | { ok: false; message: string };
  mapping: MappingResult[];
  recentErrors: Array<{
    id: string;
    createdAt: string;
    productId: string | null;
    durationId: string | null;
    providerItemId: string | null;
    errorMessage: string;
  }>;
};

/**
 * Satu tempat buat semua pengecekan kesehatan koneksi ke provider upstream
 * vipibmstore.com -- dipakai bareng oleh /api/debug/provider-mapping (JSON,
 * akses via ?secret=) dan /dashboard/admin/provider-debug (GUI, akses via
 * login admin biasa) supaya dua-duanya SELALU kasih hasil yang sama persis,
 * gak ada logic yang kebetulan beda/ketinggalan update di salah satu
 * tempat (lihat catatan panjang soal ini di provider-mapping/route.ts).
 */
export async function getProviderHealthReport(opts?: {
  productId?: string | null;
  durationId?: string | null;
  fresh?: boolean;
}): Promise<ProviderHealthReport> {
  const admin = createAdminSupabase();

  const [balanceResult, catalogResult] = await Promise.all([
    getProviderBalance(),
    getProviderProducts({ fresh: opts?.fresh }),
  ]);

  const balance: ProviderHealthReport["balance"] = balanceResult.success
    ? { ok: true, amount: balanceResult.data.balance }
    : { ok: false, message: balanceResult.message || "Gagal narik saldo dari vipibmstore.com." };

  const catalog: ProviderHealthReport["catalog"] = catalogResult.success
    ? { ok: true, size: catalogResult.data.length }
    : { ok: false, message: catalogResult.message || "Gagal narik katalog dari vipibmstore.com." };

  let mapping: MappingResult[] = [];
  if (admin && catalogResult.success) {
    let query = admin
      .from("product_durations")
      .select("id, label, price, provider_item_id, product_id, products(name)")
      .eq("stock_mode", "auto");
    if (opts?.productId) query = query.eq("product_id", opts.productId);
    if (opts?.durationId) query = query.eq("id", opts.durationId);
    const { data: durations } = await query;

    // FIX: bandingin sebagai string, dua-duanya -- vipibmstore.com balikin
    // id sebagai JSON number, kolom provider_item_id kita text. Lihat
    // catatan lengkap soal ini di provider-mapping/route.ts / orderProviderKey().
    const catalogIds = new Set(catalogResult.data.map((p) => String(p.id)));
    mapping = (durations || []).map((d) => {
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
            : "MAPPING RUSAK -- provider_item_id ini TIDAK ADA di katalog vipibmstore.com sekarang. Kemungkinan item-nya sudah dihapus/diganti ID di sisi mereka, atau salah ketik pas mapping dulu.",
      };
    });
  }

  let recentErrors: ProviderHealthReport["recentErrors"] = [];
  if (admin) {
    const { data } = await admin
      .from("provider_error_log")
      .select("id, created_at, product_id, duration_id, provider_item_id, error_message")
      .order("created_at", { ascending: false })
      .limit(20);
    recentErrors = (data || []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      productId: r.product_id,
      durationId: r.duration_id,
      providerItemId: r.provider_item_id,
      errorMessage: r.error_message,
    }));
  }

  return { checkedAt: new Date().toISOString(), balance, catalog, mapping, recentErrors };
}
