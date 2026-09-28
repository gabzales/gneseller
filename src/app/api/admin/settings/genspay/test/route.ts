import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { testGenspayConnection } from "@/lib/provider/genspay";

export async function POST(request: Request) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  // This creates a real (throwaway, unpaid) transaction against GensPay
  // each time it's run -- rate-limited tighter than the settings save
  // itself so a jumpy admin clicking "Test" repeatedly doesn't spam
  // GensPay's dashboard with test rows.
  const allowed = await checkRateLimit(admin, `admin-genspay-test:${admin_user.id}`, {
    maxHits: 10,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Terlalu banyak percobaan test, tunggu sebentar." },
      { status: 429 }
    );
  }

  const result = await testGenspayConnection();
  return NextResponse.json(result);
}
