import { guardDebug, noStoreJson } from "@/lib/debug-auth";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Browser-openable view of the persistent webhook_log table (see
 * supabase/migrations/0011_webhook_log.sql) -- shows exactly what
 * happened on every recent /api/webhooks/topup call, most recent first.
 * Answers "did GensPay even call the webhook?" and "why did it fail?"
 * without needing to dig through Vercel Runtime Logs or open Supabase.
 *
 * Usage: GET /api/debug/genspay-log?secret=X&limit=20
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const denied = guardDebug(request, "Isi GENSPAY_DEBUG_SECRET atau SETUP_ADMIN_SECRET di Vercel, redeploy, baru buka URL ini lagi.");
  if (denied) return denied;

  const admin = createAdminSupabase();
  if (!admin) return noStoreJson({ error: "service_role_missing" }, { status: 500 });

  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
  const { data, error } = await admin
    .from("webhook_log")
    .select("result, order_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return noStoreJson({ error: "query_failed", message: error.message }, { status: 500 });
  }

  return noStoreJson({
    count: data?.length ?? 0,
    entries: data ?? [],
    note:
      (data?.length ?? 0) === 0
        ? "Kosong sama sekali -- artinya GensPay belum pernah manggil /api/webhooks/topup SEJAK migration 0011 dijalankan (log baru mulai kecatat dari situ). Kalau abis ada transaksi baru dibayar dan ini masih kosong, itu bukti kuat webhook GensPay memang tidak terkirim."
        : undefined,
  });
}
