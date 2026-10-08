import { guardDebug, noStoreJson } from "@/lib/debug-auth";
import { getProviderHealthReport } from "@/lib/provider/mapping-health";

/**
 * Usage: GET /api/debug/provider-mapping?secret=X&product_id=xxx&duration_id=yyy
 *
 * Read-only diagnostic untuk masalah stock_mode=auto (mapping salah,
 * saldo vipibmstore.com habis, dll). Untuk versi GUI yang gak perlu
 * secret di URL, lihat /dashboard/admin/provider-debug (login admin
 * biasa) -- dua-duanya pakai logic yang sama persis dari
 * @/lib/provider/mapping-health.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const denied = guardDebug(request, "Isi GENSPAY_DEBUG_SECRET atau SETUP_ADMIN_SECRET di Vercel, redeploy, baru buka URL ini lagi.");
  if (denied) return denied;

  const report = await getProviderHealthReport({
    productId: searchParams.get("product_id"),
    durationId: searchParams.get("duration_id"),
    fresh: searchParams.get("fresh") === "1",
  });

  return noStoreJson(report);
}
