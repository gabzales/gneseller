import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/require-admin";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/origin-guard";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin_user = await getAdminUser();
  if (!admin_user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "bad_origin" }, { status: 403 });

  const { id: targetUserId } = await params;
  const body = await request.json().catch(() => null);
  const amount = Math.trunc(Number(body?.amount));
  const note = typeof body?.note === "string" ? body.note.slice(0, 300) : null;

  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "invalid_amount", message: "Nominal tidak valid." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: "service_role_missing" }, { status: 500 });

  // Rate-limited per admin, not per target -- an admin adjusting many
  // resellers in a row is normal; this just caps runaway/scripted abuse
  // of an endpoint that can move real money, same reasoning as
  // generate-key and topup/create.
  const allowed = await checkRateLimit(admin, `admin-adjust-balance:${admin_user.id}`, {
    maxHits: 30,
    windowSeconds: 60,
  });
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited", message: "Terlalu banyak percobaan, coba lagi sebentar." }, { status: 429 });
  }

  const { data, error } = await admin.rpc("admin_adjust_balance", {
    p_admin_id: admin_user.id,
    p_user_id: targetUserId,
    p_amount: amount,
    p_note: note,
  });

  if (error) {
    const known: Record<string, { status: number; message: string }> = {
      user_not_found: { status: 404, message: "Reseller tidak ditemukan." },
      insufficient_balance: { status: 400, message: "Saldo tidak boleh jadi minus." },
      invalid_amount: { status: 400, message: "Nominal tidak valid." },
    };
    const match = Object.entries(known).find(([code]) => error.message.includes(code));
    const info = match?.[1] ?? { status: 500, message: "Gagal menyesuaikan saldo." };
    return NextResponse.json({ error: match?.[0] ?? "unknown", message: info.message }, { status: info.status });
  }

  return NextResponse.json({ balance: data.balance });
}
