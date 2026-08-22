import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Polled by TopupForm's QR modal every few seconds while a GensPay QRIS
 * payment is pending -- webhook settlement is still the source of truth
 * (see src/app/api/webhooks/topup/route.ts), this endpoint just lets the
 * client find out it already happened without a full page reload.
 *
 * Reads via the user's own session (RLS "users read own topups" policy),
 * NOT the service-role client -- this route only ever needs to read a row
 * the requesting user already owns, so there's no reason to bypass RLS
 * here the way /api/topup/create and the webhook legitimately do.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  if (!ref) {
    return NextResponse.json({ error: "missing_ref" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!user || !supabase) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("topups")
    .select("status, total, nominal, bonus")
    .eq("merchant_ref", ref)
    .eq("user_id", user.id) // belt-and-suspenders on top of RLS -- explicit is cheap here
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status as "pending" | "success" | "expired" | "failed",
    total: data.total,
    nominal: data.nominal,
    bonus: data.bonus,
  });
}
