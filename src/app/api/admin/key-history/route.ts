import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Admin-wide key ledger, reading from public.admin_key_history (a plain
 * view over reseller_keys joined to users -- see 0006_reseller_ops.sql).
 * Zero grants on the underlying view for anon/authenticated, so this is
 * only reachable via the service-role client, gated by getAdminUser().
 *
 * ?q= filters client-side-style but server-executed against name/email/
 * product name/key string, so a large table doesn't need to ship
 * everything to the browser just to let admin search.
 */
export async function GET(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  let query = admin
    .from("admin_key_history")
    .select("id, user_id, full_name, email, product_name, duration_label, price, key_string, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    // Escape characters that have special meaning inside PostgREST's
    // or() filter string (comma separates conditions, parens group them)
    // so a search term containing them can't break out of the filter.
    const safe = q.replace(/[,()]/g, "");
    query = query.or(
      `full_name.ilike.%${safe}%,email.ilike.%${safe}%,product_name.ilike.%${safe}%,key_string.ilike.%${safe}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "fetch_failed", message: error.message }, { status: 500 });

  return NextResponse.json({
    keys: (data ?? []).map((k) => ({
      id: k.id,
      userId: k.user_id,
      resellerName: k.full_name || k.email,
      resellerEmail: k.email,
      productName: k.product_name,
      duration: k.duration_label,
      price: k.price,
      keyString: k.key_string,
      createdAt: k.created_at,
    })),
  });
}
