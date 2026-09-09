import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/origin-guard";

/**
 * Marks one or all broadcasts as read for the signed-in user. Uses the
 * cookie-bound client -- RLS policy "users mark own broadcast reads"
 * already restricts this to auth.uid() = user_id, so no service role is
 * needed and a user can never mark reads on someone else's behalf.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ error: "service_unavailable" }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const broadcastId = typeof body?.broadcastId === "string" ? body.broadcastId : null;

  if (broadcastId) {
    const { error } = await supabase
      .from("broadcast_reads")
      .upsert({ broadcast_id: broadcastId, user_id: user.id }, { onConflict: "broadcast_id,user_id" });
    if (error) return NextResponse.json({ error: "mark_failed", message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Mark-all: fetch every broadcast id not yet read, then insert reads
  // for each. Small volume (broadcasts are infrequent by nature), so a
  // plain fetch + upsert loop is fine without a dedicated RPC.
  const { data: broadcasts, error: listError } = await supabase.from("broadcasts").select("id");
  if (listError) return NextResponse.json({ error: "fetch_failed", message: listError.message }, { status: 500 });

  const rows = (broadcasts ?? []).map((b) => ({ broadcast_id: b.id, user_id: user.id }));
  if (rows.length > 0) {
    const { error } = await supabase.from("broadcast_reads").upsert(rows, { onConflict: "broadcast_id,user_id" });
    if (error) return NextResponse.json({ error: "mark_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
