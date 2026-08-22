import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Reseller-facing broadcast list, with `read` computed per-item from
 * broadcast_reads (RLS-scoped to the caller's own reads, see
 * 0006_reseller_ops.sql). Uses the cookie-bound client, not the admin
 * client -- broadcasts are readable by any signed-in user (RLS policy
 * "broadcasts readable by signed-in users"), no service role needed.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: broadcasts, error: bError }, { data: reads, error: rError }] = await Promise.all([
    supabase.from("broadcasts").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("broadcast_reads").select("broadcast_id").eq("user_id", user.id),
  ]);

  if (bError) return NextResponse.json({ error: "fetch_failed", message: bError.message }, { status: 500 });

  const readIds = new Set((reads ?? []).map((r) => r.broadcast_id));
  const items = (broadcasts ?? []).map((b) => ({
    id: b.id,
    title: b.title,
    body: b.body,
    createdAt: b.created_at,
    read: readIds.has(b.id),
  }));

  return NextResponse.json({
    broadcasts: items,
    unreadCount: rError ? 0 : items.filter((i) => !i.read).length,
  });
}
